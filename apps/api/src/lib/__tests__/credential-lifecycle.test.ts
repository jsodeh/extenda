import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { it } from 'node:test';

it(
    'migrates legacy grants, fences refresh and delivery, and rejects pre-disconnect approvals',
    { skip: !process.env.TEST_DATABASE_URL },
    async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
        const { runMigrations } = await import('../../db/migrate.js');
        const { pool } = await import('../../db/index.js');
        const { oauthManager: oauth } = await import('../../services/oauth-manager.js');
        const { executeDueJobs } = await import('../../services/scheduler.js');
        const owner = randomUUID(),
            originalFetch = globalThis.fetch;
        await runMigrations();
        const connect = (sub: string) =>
            oauth.storeCredentials({
                userId: owner,
                provider: 'google',
                accessToken: 'fixture-access-' + sub,
                refreshToken: 'fixture-refresh-' + sub,
                metadata: { sub }
            });
        try {
            await pool.query(
                'INSERT INTO users(id,email,google_access_token,google_refresh_token) VALUES($1,$2,$3,$4)',
                [owner, owner + '@example.test', 'fixture-legacy', 'fixture-refresh']
            );
            const migrated = await Promise.all([
                oauth.getCredentials(owner, 'google'),
                oauth.getCredentials(owner, 'google')
            ]);
            assert.deepEqual(migrated, [null, null]);
            assert.deepEqual(await oauth.getConnectedProviders(owner), []);
            await assert.rejects(oauth.refreshToken(owner, 'google'), /No refresh token/);
            const stored = (
                await pool.query('SELECT encrypted_access_token FROM oauth_credentials WHERE user_id=$1', [owner])
            ).rows[0];
            assert.doesNotMatch(stored.encrypted_access_token, /fixture-legacy/);
            const legacy = () =>
                pool.query('SELECT google_access_token,google_refresh_token FROM users WHERE id=$1', [owner]);
            assert.deepEqual((await legacy()).rows[0], { google_access_token: null, google_refresh_token: null });

            await connect('original');
            const one = await oauth.current(owner, 'google');
            let respond!: (response: Response) => void, started!: () => void;
            const pending = new Promise<void>((resolve) => {
                started = resolve;
            });
            globalThis.fetch = async () => {
                started();
                return new Promise((resolve) => {
                    respond = resolve;
                });
            };
            const refresh = oauth.refreshToken(owner, 'google');
            await pending;
            // Reproduce a partially migrated database that has both canonical and stale plaintext tokens.
            await pool.query("UPDATE users SET google_access_token='fixture-stale' WHERE id=$1", [owner]);
            await oauth.deleteCredentials(owner, 'google');
            respond(Response.json({ access_token: 'fixture-late', expires_in: 3600 }));
            await assert.rejects(refresh, /changed/);
            assert.equal(await oauth.getCredentials(owner, 'google'), null);
            assert.deepEqual(await oauth.getConnectedProviders(owner), []);
            assert.deepEqual((await legacy()).rows[0], { google_access_token: null, google_refresh_token: null });

            const dueJob = async (binding: unknown) => {
                const {
                    rows: [job]
                } = await pool.query(
                    `INSERT INTO scheduled_jobs(user_id,action,due_at,timezone,approved_payload,idempotency_key,approval)
                VALUES($1,'calendar',now(),'UTC',$2,$3,'fixture-review') RETURNING id`,
                    [owner, { accountBinding: binding, summary: 'Synthetic event' }, randomUUID()]
                );
                await executeDueJobs(1, job.id);
                return (await pool.query('SELECT status,result FROM scheduled_jobs WHERE id=$1', [job.id]))
                    .rows[0];
            };
            assert.equal((await dueJob(one.binding)).status, 'failed');
            await connect('member-one');
            await pool.query("UPDATE users SET google_refresh_token='fixture-older' WHERE id=$1", [owner]);
            assert.equal((await oauth.getCredentials(owner, 'google'))?.accessToken, 'fixture-access-member-one');
            assert.deepEqual((await legacy()).rows[0], { google_access_token: null, google_refresh_token: null });
            const active = await oauth.current(owner, 'google');
            await connect('member-two');
            const changed = await oauth.current(owner, 'google');
            assert.notEqual(changed.binding, active.binding);
            const delivery = await dueJob(active.binding);
            assert.equal(delivery.status, 'failed');
            assert.match(delivery.result.message, /review/);
            assert.equal((await dueJob(undefined)).status, 'failed');
            await assert.rejects(
                oauth.withGrant(owner, 'google', active.binding, async () => assert.fail('old grant was used')),
                /changed/
            );
            assert.equal(
                await oauth.withGrant(owner, 'google', changed.binding, async (grant) => grant.metadata?.sub),
                'member-two'
            );

            let finish!: () => void, entered!: () => void;
            const dispatched = new Promise<void>((resolve) => {
                entered = resolve;
            });
            const inFlight = oauth.withGrant(owner, 'google', changed.binding, async () => {
                entered();
                await new Promise<void>((r) => {
                    finish = r;
                });
            });
            await dispatched;
            const nonce = randomUUID();
            await pool.query("INSERT INTO oauth_link_states(nonce,user_id,provider) VALUES($1,$2,'google')", [
                nonce,
                owner
            ]);
            const disconnect = oauth.deleteCredentials(owner, 'google');
            finish();
            await Promise.all([inFlight, disconnect]);
            await assert.rejects(
                oauth.storeCredentials(
                    { userId: owner, provider: 'google', accessToken: 'fixture-late-link' },
                    nonce
                ),
                /expired/
            );
            await assert.rejects(
                oauth.withGrant(owner, 'google', changed.binding, async () =>
                    assert.fail('disconnected account was used')
                ),
                /Reconnect/
            );
        } finally {
            globalThis.fetch = originalFetch;
            await pool.query('DELETE FROM users WHERE id=$1', [owner]);
            await pool.end();
        }
    }
);
