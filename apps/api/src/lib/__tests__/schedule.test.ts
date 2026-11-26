import { it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validTimezone, timeRange, instant } from '../scheduling.js';
it('validates timezones, offsets and increasing calendar ranges', () => {
    assert.equal(validTimezone('Africa/Lagos'), 'Africa/Lagos');
    assert.throws(() => validTimezone('Bad/Zone'));
    assert.throws(() => instant('2026-03-08T02:30:00'));
    assert.throws(() => timeRange('2026-03-08T02:00:00Z', '2026-03-08T01:00:00Z'));
});
it(
    'persists approved reminders, claims once across concurrent workers and recovers uncertain writes',
    { skip: !process.env.TEST_DATABASE_URL },
    async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        const { pool } = await import('../../db/index.js');
        const { runMigrations } = await import('../../db/migrate.js');
        const { enqueue, executeDueJobs } = await import('../../services/scheduler.js');
        const owner = randomUUID();
        await runMigrations();
        try {
            await pool.query('INSERT INTO users(id,email) VALUES($1,$2)', [owner, owner + '@example.test']);
            const params = {
                action: 'reminder',
                at: new Date(Date.now() + 60000).toISOString(),
                timezone: 'America/New_York',
                recurrence: 'weekly',
                payload: { message: 'Review progress' }
            };
            await assert.rejects(enqueue(owner, params, 'fixture', ''));
            const job = await enqueue(owner, params, 'fixture', 'reviewed');
            assert.equal((await enqueue(owner, params, 'fixture', 'reviewed')).id, job.id);
            await pool.query("UPDATE scheduled_jobs SET due_at='2026-03-06 14:00+00' WHERE id=$1", [job.id]);
            await Promise.all([executeDueJobs(1), executeDueJobs(1)]);
            const {
                rows: [row]
            } = await pool.query(
                'SELECT status,extract(hour from due_at at time zone timezone) AS hour,attempts FROM scheduled_jobs WHERE id=$1',
                [job.id]
            );
            assert.equal(row.status, 'pending');
            assert.equal(Number(row.hour), 9);
            assert.equal(row.attempts, 1);
            assert.equal(
                (await pool.query('SELECT * FROM personal_reminders WHERE job_id=$1', [job.id])).rowCount,
                1
            );
            await pool.query(
                "UPDATE scheduled_jobs SET action='calendar',status='running',claimed_at=now()-interval '1 hour' WHERE id=$1",
                [job.id]
            );
            await executeDueJobs(1);
            assert.equal(
                (await pool.query('SELECT status FROM scheduled_jobs WHERE id=$1', [job.id])).rows[0].status,
                'uncertain'
            );
        } finally {
            await pool.query('DELETE FROM users WHERE id=$1', [owner]);
            await pool.end();
        }
    }
);
