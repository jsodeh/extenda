CREATE TABLE IF NOT EXISTS "oauth_credentials" (
    "id" SERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "provider" VARCHAR(50) NOT NULL,
    "encrypted_access_token" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT,
    "token_type" VARCHAR(20) DEFAULT 'Bearer',
    "expires_at" TIMESTAMP,
    "scope" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW(),
    UNIQUE("user_id", "provider")
);

CREATE INDEX IF NOT EXISTS "idx_oauth_user_provider" ON "oauth_credentials"("user_id", "provider");
CREATE INDEX IF NOT EXISTS "idx_oauth_expires" ON "oauth_credentials"("expires_at");
