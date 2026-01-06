-- User authentication enhancements
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login" TIMESTAMP;

-- Sessions table for JWT refresh tokens
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "refresh_token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_refresh_token" ON "sessions"("refresh_token");

-- Workflow persistence
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "state" JSONB;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "paused_at" TIMESTAMP;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "resumed_at" TIMESTAMP;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "can_resume" BOOLEAN DEFAULT true;
