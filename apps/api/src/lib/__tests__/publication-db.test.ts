import { it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';

it(
    'invalidates the scheduled version on edit and records one provider receipt after rate limiting',
    { skip: !process.env.TEST_DATABASE_URL },
    async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
        const { pool } = await import('../../db/index.js');
        const { runMigrations } = await import('../../db/migrate.js');
        const { oauthManager } = await import('../../services/oauth-manager.js');
        const { saveDraft, preparePost, queuePost, editDraft, drafts } =
            await import('../../services/linkedin.js');
        const { executeDueJobs } = await import('../../services/scheduler.js');
        const owner = randomUUID(),
            originalFetch = globalThis.fetch;
        const member = 'fixture-person';
        const due = async (id: string) =>
            pool.query("UPDATE scheduled_jobs SET due_at=now()-interval '1 second' WHERE id=$1", [id]);
        const state = async (id: string) =>
            (await pool.query('SELECT status FROM scheduled_jobs WHERE id=$1', [id])).rows[0].status;
        let attempts = 0,
            refreshes = 0;
        await runMigrations();
        try {
            await pool.query('INSERT INTO users(id,email) VALUES($1,$2)', [owner, owner + '@example.test']);
            globalThis.fetch = async (input) => {
                if (String(input).endsWith('/accessToken')) {
                    refreshes++;
                    return Response.json({ access_token: 'new-fixture-token', expires_in: 3600 });
                }
                if (String(input).endsWith('/userinfo')) return Response.json({ sub: member });
                assert.match(String(input), /ugcPosts$/);
                attempts++;
                return attempts === 1
                    ? new Response(null, { status: 429 })
                    : new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:987' } });
            };
            await oauthManager.storeCredentials({
                userId: owner,
                provider: 'linkedin',
                scope: 'openid w_member_social',
                accessToken: 'test',
                refreshToken: 'fixture',
                expiresAt: new Date(0),
                metadata: { sub: member }
            });
            const draft = await saveDraft(owner, { text: 'First version', visibility: 'PUBLIC' });
            const params = {
                draftId: draft.draftId,
                at: new Date(Date.now() + 60000).toISOString(),
                timezone: 'Africa/Lagos'
            };
            const old = await preparePost(owner, params);
            assert.equal(refreshes, 1);
            const first = await queuePost(owner, old, 'version1', 'old-review');
            await editDraft(owner, draft.draftId, draft.version, {
                text: 'Edited version',
                visibility: 'CONNECTIONS'
            });
            assert.equal(await state(String(first.id)), 'cancelled');
            await assert.rejects(queuePost(owner, old, 'stale', 'old-review'), /changed/);
            const updated = await preparePost(owner, params);
            const job = await queuePost(owner, updated, 'version2', 'new-review');
            const id = String(job.id);
            await due(id);
            await executeDueJobs(1, id);
            assert.equal(await state(id), 'pending');
            await due(id);
            await Promise.all([executeDueJobs(1, id), executeDueJobs(1, id)]);
            assert.equal(attempts, 2);
            assert.equal(await state(id), 'completed');
            assert.equal(
                (await drafts(owner))[0].result.postUrl,
                'https://www.linkedin.com/feed/update/urn:li:share:987/'
            );
            assert.equal((await drafts(randomUUID())).length, 0);
        } finally {
            globalThis.fetch = originalFetch;
            await pool.query('DELETE FROM users WHERE id=$1', [owner]);
            await pool.end();
        }
    }
);
