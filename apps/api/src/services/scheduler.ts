import { publishPost, ProviderFailure } from './linkedin.js';
import { pool } from '../db/index.js';
import { instant, validTimezone } from '../lib/scheduling.js';
import { GoogleCalendarAdapter } from '../adapters/google-calendar.js';
import { oauthManager } from './oauth-manager.js';

export async function enqueue(owner: string, params: any, key: string, approval: string) {
    if (!owner || !key || !approval) throw new Error('Review this exact scheduled action first');
    const { action, payload, timezone, recurrence = 'once' } = params;
    const due = instant(params.at);
    validTimezone(timezone);
    if (!['reminder', 'calendar'].includes(action))
        throw new Error('This action requires a connected browser or an unsupported provider');
    if (due.getTime() < Date.now() - 1000) throw new Error('Choose a future execution time');
    if (!['once', 'daily', 'weekly'].includes(recurrence) || (action !== 'reminder' && recurrence !== 'once'))
        throw new Error('Use calendar recurrence rules for recurring events');
    if (
        !payload ||
        (action === 'reminder' ? !payload.message : !payload.summary || !payload.start || !payload.end)
    )
        throw new Error('Incomplete scheduled payload');
    const { rows } = await pool.query(
        `INSERT INTO scheduled_jobs(user_id,action,due_at,timezone,recurrence,approved_payload,idempotency_key,approval)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,idempotency_key) DO UPDATE SET idempotency_key=excluded.idempotency_key
        WHERE scheduled_jobs.approval=excluded.approval RETURNING id,due_at,status`,
        [owner, action, due, timezone, recurrence, payload, key, approval]
    );
    if (!rows.length) throw new Error('Scheduled payload changed. Request a new review.');
    return rows[0];
}

export async function executeDueJobs(limit = 40, onlyId?: string) {
    await pool.query("UPDATE scheduled_jobs SET status='pending' WHERE action='reminder' AND status='running' AND claimed_at < now()-interval '20 minutes'");
    // A remote service might have accepted a request before a worker stopped. Quarantine such jobs.
    await pool.query(
        "UPDATE scheduled_jobs SET status='uncertain',result='{\"message\":\"Check provider history before rescheduling\"}' WHERE action<>'reminder' AND status='running' AND claimed_at < now()-interval '20 minutes'"
    );
    for (let n = 0; n < limit; n++) {
        const {
            rows: [job]
        } = await pool.query(
            `UPDATE scheduled_jobs SET status='running',attempts=attempts+1,claimed_at=now()
            WHERE id=(SELECT id FROM scheduled_jobs WHERE status='pending' AND due_at<=now() AND ($1::uuid IS NULL OR id=$1)
            ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
            [onlyId || null]
        );
        if (!job) return;
        let externalStarted = false;
        try {
            if (!job.approval || !['reminder','calendar','linkedin'].includes(job.action))
                throw new Error('Unapproved or unsupported action');
            let result: any;
            if (job.action === 'reminder') {
                await pool.query(
                    'INSERT INTO personal_reminders(job_id,occurrence,message) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
                    [job.id, job.due_at, job.approved_payload.message]
                );
                result = { message: job.approved_payload.message };
            } else if (job.action === 'linkedin') {
                result = await oauthManager.withGrant(job.user_id,'linkedin',job.approved_payload.accountBinding, async grant => {
                    if ('urn:li:person:'+grant.metadata?.sub !== job.approved_payload.author ||
                        !grant.scope?.split(/[ ,]+/).includes('w_member_social'))
                        throw new ProviderFailure('Reconnect the approved account and review the post again',403);
                    externalStarted = true;
                    return publishPost(job.approved_payload,grant.accessToken);
                });
            } else {
                result = await oauthManager.withGrant(job.user_id,'google',job.approved_payload.accountBinding, async grant => {
                    externalStarted = true;
                    return new GoogleCalendarAdapter().execute('create_event', job.approved_payload, {
                        tokens:{access_token:grant.accessToken}, idempotencyKey:job.id
                    });
                });
            }
            // Advance from the approved local wall clock. Skip missed occurrences after downtime.
            await pool.query(
                `UPDATE scheduled_jobs SET result=$2,status=CASE recurrence WHEN 'once' THEN 'completed' ELSE 'pending' END,
                due_at=CASE WHEN recurrence='once' THEN due_at ELSE (
                    SELECT min(t AT TIME ZONE timezone) FROM generate_series(due_at AT TIME ZONE timezone,
                    (now() AT TIME ZONE timezone)+interval '8 days', CASE recurrence WHEN 'daily' THEN interval '1 day' ELSE interval '7 days' END) t
                    WHERE t AT TIME ZONE timezone > now()) END WHERE id=$1 AND status='running' AND attempts=$3`,
                [job.id, result, job.attempts]
            );
        } catch (error) {
            if (error instanceof ProviderFailure && error.status === 429 && job.attempts < 3) {
                await pool.query(
                    "UPDATE scheduled_jobs SET status='pending',due_at=now()+$2*interval '1 second' WHERE id=$1 AND status='running' AND attempts=$3",
                    [job.id, Math.max(60, error.retryAfter), job.attempts]
                );
                continue;
            }
            if (error instanceof ProviderFailure && error.status < 500 && ![408,409].includes(error.status)) {
                await pool.query("UPDATE scheduled_jobs SET status='failed',result=$2 WHERE id=$1 AND status='running' AND attempts=$3", [
                    job.id,
                    { message: error.message }, job.attempts
                ]);
                continue;
            }
            const message = externalStarted
                ? 'Check provider history before retrying'
                : 'Delivery stopped. Reconnect the provider and review a new scheduled action.';
            await pool.query("UPDATE scheduled_jobs SET status=$2,result=$3 WHERE id=$1 AND status='running' AND attempts=$4", [
                job.id,
                externalStarted ? 'uncertain' : 'failed',
                { message }, job.attempts
            ]);
        }
    }
}
