CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    action text NOT NULL, due_at timestamptz NOT NULL, timezone text NOT NULL, recurrence text NOT NULL DEFAULT 'once',
    status text NOT NULL DEFAULT 'pending', approved_payload jsonb NOT NULL, approval text NOT NULL,
    idempotency_key text NOT NULL, attempts integer NOT NULL DEFAULT 0, result jsonb,
    claimed_at timestamptz, created_at timestamptz DEFAULT now(), UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS jobs_due ON scheduled_jobs(due_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS personal_reminders (
    job_id uuid REFERENCES scheduled_jobs ON DELETE CASCADE, occurrence timestamptz NOT NULL,
    message text NOT NULL, delivered boolean NOT NULL DEFAULT false, PRIMARY KEY(job_id,occurrence)
);
