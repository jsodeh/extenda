CREATE TABLE IF NOT EXISTS linkedin_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    content text NOT NULL, visibility text NOT NULL, link text, version integer NOT NULL DEFAULT 1,
    job_id uuid REFERENCES scheduled_jobs ON DELETE SET NULL, created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS draft_owner ON linkedin_drafts(user_id);
CREATE TABLE IF NOT EXISTS oauth_link_states (
    nonce uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, provider text NOT NULL,
    expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
-- Remove copies of provider tokens accidentally stored outside the encrypted columns.
UPDATE oauth_credentials SET metadata=metadata-'rawResponse' WHERE metadata ? 'rawResponse';
