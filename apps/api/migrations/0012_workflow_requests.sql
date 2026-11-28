CREATE TABLE IF NOT EXISTS workflow_requests (
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, request_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,request_id)
);
-- Previous releases persisted live model and OAuth credentials in execution context.
UPDATE executions SET context=context-'modelConfig'-'tokens'
WHERE context ?| ARRAY['modelConfig','tokens'];
