import { oauthManager } from '../services/oauth-manager.js';
import { linkedAccount, queuePost, saveDraft, drafts } from '../services/linkedin.js';
import { executeDueJobs } from '../services/scheduler.js';
import { pool } from '../db/index.js';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'save_draft',
        name: 'save_draft',
        description:
            'Save an editable private draft. Ground posts in relevant evidence. Respect requested tone and avoid confidential details.',
        parameters: {
            type: 'object',
            required: ['text'],
            properties: { text: { type: 'string' }, visibility: { type: 'string' }, link: { type: 'string' } }
        }
    },
    {
        id: 'create_post',
        name: 'create_post',
        description: 'Create a post on LinkedIn',
        parameters: {
            type: 'object',
            required: [],
            properties: {
                draftId: { type: 'string', description: 'Saved draft ID, or supply text' },
                at: { type: 'string', description: 'Optional approved publication time with offset' },
                timezone: { type: 'string' },
                text: { type: 'string', description: 'Post text content' },
                link: { type: 'string', description: 'Optional link to include' },
                visibility: {
                    type: 'string',
                    description: 'Post visibility: PUBLIC or CONNECTIONS',
                    enum: ['PUBLIC', 'CONNECTIONS']
                }
            }
        }
    },
    {
        id: 'get_profile',
        name: 'get_profile',
        description: 'Get user LinkedIn profile information',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        id: 'delete_post',
        name: 'delete_post',
        description: 'Delete a post from LinkedIn',
        parameters: {
            type: 'object',
            required: ['postId'],
            properties: {
                postId: { type: 'string', description: 'ID of the post to delete' }
            }
        }
    },
    {
        id: 'list_posts',
        name: 'list_posts',
        description: 'List recent posts by the user',
        parameters: {
            type: 'object',
            properties: {
                count: { type: 'number', description: 'Number of posts to return' }
            }
        }
    }
];

export class LinkedInAdapter extends BaseAdapter {
    id = 'linkedin';
    type = 'oauth' as const;
    provider = 'linkedin';
    name = 'LinkedInAdapter';
    description = 'Post content and manage LinkedIn profile';
    version = '1.0.0';
    scopes = ['openid', 'profile', 'email', 'w_member_social'];
    actions = ACTIONS;

    async execute(action: string, params: any, context: any) {
        const owner = context.userId;
        if (!owner) throw new Error('An authenticated member is required');
        if (action === 'save_draft')
            return saveDraft(owner, { ...params, visibility: params.visibility || 'PUBLIC' });
        if (action === 'list_posts') return await drafts(owner);
        if (action === 'get_profile') {
            const account = await linkedAccount(owner);
            if (!account) throw new Error('Reconnect LinkedIn');
            const res = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: 'Bearer ' + account.token }
            });
            if (!res.ok) throw new Error('LinkedIn profile unavailable');
            return res.json();
        }
        if (action === 'create_post') {
            if (!params.author) {
                const draft = params.draftId ? { draftId: params.draftId } : await saveDraft(owner, params);
                throw new Error(
                    'Publishing permission unavailable. Copy draft ' +
                        draft.draftId +
                        ' from LinkedIn in Integrations.'
                );
            }
            const job = await queuePost(owner, params, context.idempotencyKey, context.approval);
            if (params.at) return { scheduled: true, at: job.due_at, jobId: job.id };
            await executeDueJobs(1, String(job.id));
            const {
                rows: [receipt]
            } = await pool.query('SELECT status,result FROM scheduled_jobs WHERE id=$1 AND user_id=$2', [
                job.id,
                owner
            ]);
            if (receipt.status !== 'completed')
                throw new Error(receipt.result?.message || 'Publication pending. Check scheduled tasks.');
            return receipt.result;
        }
        if (action === 'delete_post') {
            if (!context.approval) throw new Error('Review LinkedIn deletion');
            return oauthManager.withGrant(owner,'linkedin',params.accountBinding, async grant => {
                const res = await fetch('https://api.linkedin.com/v2/ugcPosts/' + encodeURIComponent(params.postId), {
                    method:'DELETE', headers:{ Authorization:'Bearer '+grant.accessToken, 'X-Restli-Protocol-Version':'2.0.0' },
                    signal:AbortSignal.timeout(20000)
                });
                if (!res.ok) throw new Error('LinkedIn rejected deletion');
                return {deleted:params.postId};
            });
        }
        throw new Error('Unknown LinkedIn action');
    }
}
