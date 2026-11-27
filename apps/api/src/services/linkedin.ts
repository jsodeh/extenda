import { oauthManager } from './oauth-manager.js';
import { pool, db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { instant, validTimezone } from '../lib/scheduling.js';

export interface Post {
    text: string;
    visibility: 'PUBLIC' | 'CONNECTIONS';
    link?: string;
    author?: string;
}
export function validatePost(data: Post) {
    if (
        !data ||
        typeof data.text !== 'string' ||
        !data.text.trim() ||
        data.text.length > 3000 ||
        !['PUBLIC', 'CONNECTIONS'].includes(data.visibility)
    )
        throw new Error('Check post length and visibility');
    if (data.link && !['https:', 'http:'].includes(new URL(data.link).protocol))
        throw new Error('Invalid post URL');
}

export class ProviderFailure extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly retryAfter = 0
    ) {
        super(message);
    }
}
export async function publishPost(post: Post, token: string, request: typeof fetch = fetch) {
    validatePost(post);
    const headers = {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
    };
    const identity = await request('https://api.linkedin.com/v2/userinfo', {
        headers,
        signal: AbortSignal.timeout(12000)
    });
    if (!identity.ok) throw new ProviderFailure('Reconnect LinkedIn before publishing', identity.status);
    if (post.author !== 'urn:li:person:' + (await identity.json()).sub)
        throw new ProviderFailure('LinkedIn account changed. Review this draft again.', 403);
    const share = {
        shareCommentary: { text: post.text },
        shareMediaCategory: post.link ? 'ARTICLE' : 'NONE',
        ...(post.link ? { media: [{ status: 'READY', originalUrl: post.link }] } : {})
    };
    const response = await request('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
            author: post.author,
            lifecycleState: 'PUBLISHED',
            specificContent: { 'com.linkedin.ugc.ShareContent': share },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': post.visibility }
        })
    });
    if (!response.ok) {
        const retry = response.headers.get('retry-after') || '';
        const seconds = /^\d+$/.test(retry) ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000);
        throw new ProviderFailure(
            'LinkedIn rejected publication (' + response.status + '). Open the draft for manual publishing.',
            response.status,
            Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 60
        );
    }
    const id = response.headers.get('x-restli-id');
    if (response.status !== 201 || !id || !/^urn:li:(share|ugcPost):\d+$/.test(id))
        throw new Error('Publication outcome unknown. Check LinkedIn.');
    return { postId: id, postUrl: `https://www.linkedin.com/feed/update/${id}/` };
}

export async function linkedAccount(owner: string) {
    let credentials = await oauthManager.getCredentials(owner, 'linkedin');
    if (credentials?.refreshToken && oauthManager.isTokenExpired(credentials.expiresAt)) {
        try {
            credentials = await oauthManager.refreshToken(owner, 'linkedin');
        } catch {
            return null;
        }
    }
    if (
        !credentials ||
        oauthManager.isTokenExpired(credentials.expiresAt) ||
        !credentials.scope?.split(/[ ,]+/).includes('w_member_social') ||
        !credentials.metadata?.sub
    )
        return null;
    return { author: 'urn:li:person:' + credentials.metadata.sub, token: credentials.accessToken };
}

export async function drafts(owner: string) {
    return (
        await pool.query(
            `SELECT d.id,d.content AS text,d.visibility,d.link,d.version,j.status,j.result,j.due_at
        FROM linkedin_drafts d LEFT JOIN scheduled_jobs j ON j.id=d.job_id WHERE d.user_id=$1 ORDER BY d.updated_at DESC`,
            [owner]
        )
    ).rows;
}

export async function saveDraft(owner: string, data: Post) {
    validatePost(data);
    const {
        rows: [draft]
    } = await pool.query(
        `INSERT INTO linkedin_drafts(user_id,content,visibility,link) VALUES($1,$2,$3,$4)
        RETURNING id AS "draftId",version,content AS text,visibility,link`,
        [owner, data.text, data.visibility, data.link || null]
    );
    return draft;
}

export async function editDraft(owner: string, id: string, version: number, data: Post) {
    validatePost(data);
    return db.transaction(async (tx) => {
        const {
            rows: [draft]
        } = await tx.execute(
            sql`SELECT job_id FROM linkedin_drafts WHERE id=${id} AND user_id=${owner} AND version=${version} FOR UPDATE`
        );
        if (!draft) throw new Error('Draft changed. Reload it.');
        if (draft.job_id) {
            const {
                rows: [job]
            } = await tx.execute(sql`SELECT status FROM scheduled_jobs WHERE id=${draft.job_id} FOR UPDATE`);
            if (['running', 'completed', 'uncertain'].includes(String(job?.status)))
                throw new Error('Publication already started. Create a new draft.');
            await tx.execute(sql`UPDATE scheduled_jobs SET status='cancelled' WHERE id=${draft.job_id}`);
        }
        await tx.execute(sql`UPDATE linkedin_drafts SET content=${data.text},visibility=${data.visibility},link=${data.link || null},
            version=version+1,job_id=NULL,updated_at=now() WHERE id=${id}`);
    });
}

export async function preparePost(owner: string, params: any) {
    let content = { text: params.text, visibility: params.visibility || 'PUBLIC', link: params.link || null };
    let version;
    if (params.draftId) {
        const {
            rows: [draft]
        } = await pool.query(
            'SELECT content AS text,visibility,link,version FROM linkedin_drafts WHERE user_id=$1 AND id=$2',
            [owner, params.draftId]
        );
        if (!draft) throw new Error('Draft unavailable');
        content = { text: draft.text, visibility: draft.visibility, link: draft.link };
        version = draft.version;
    }
    validatePost(content);
    const account = await linkedAccount(owner);
    return {
        ...content,
        draftId: params.draftId,
        version,
        author: account?.author || null,
        at: params.at || null,
        timezone: validTimezone(params.timezone || 'UTC')
    };
}

export async function queuePost(owner: string, post: any, key: string, approval: string) {
    if (!approval || !key || !post.author)
        throw new Error('Reconnect LinkedIn or copy the reviewed draft to LinkedIn manually');
    const at = post.at ? instant(post.at) : new Date();
    if (post.at && at.getTime() < Date.now() - 1000) throw new Error('Choose a future publication time');
    return db.transaction(async (tx) => {
        if (post.draftId) {
            const {
                rows: [draft]
            } = await tx.execute(sql`SELECT content,visibility,link,job_id,version FROM linkedin_drafts
                WHERE user_id=${owner} AND id=${post.draftId} FOR UPDATE`);
            if (
                !draft ||
                draft.version !== post.version ||
                draft.content !== post.text ||
                draft.visibility !== post.visibility ||
                (draft.link || null) !== (post.link || null)
            )
                throw new Error('Post changed. Review it again.');
            if (draft.job_id) throw new Error('This draft already has a publication attempt. Check history.');
        }
        const {
            rows: [job]
        } =
            await tx.execute(sql`INSERT INTO scheduled_jobs(user_id,action,due_at,timezone,approved_payload,idempotency_key,approval)
            VALUES(${owner},'linkedin',${at.toISOString()},${post.timezone},${JSON.stringify(post)}::jsonb,${key},${approval})
            ON CONFLICT(user_id,idempotency_key) DO NOTHING RETURNING id,due_at`);
        if (!job) throw new Error('Already scheduled. Check publication history.');
        if (post.draftId)
            await tx.execute(
                sql`UPDATE linkedin_drafts SET job_id=${job.id} WHERE id=${post.draftId} AND user_id=${owner}`
            );
        return job;
    });
}
