-- Consolidated Schema Sync for Chat History and missing migrations

-- From 0003_oauth_credentials
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

-- From 0004_user_preferences
CREATE TABLE IF NOT EXISTS "user_preferences" (
    "id" SERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE UNIQUE,
    "data_sources" JSONB DEFAULT '{"browser_history": false, "bookmarks": false, "tabs": true}'::jsonb,
    "enabled_tools" JSONB DEFAULT '[]'::jsonb,
    "ai_settings" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_user_preferences_user" ON "user_preferences"("user_id");

-- From 0005_knowledgebase
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS "documents" (
    "id" SERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) DEFAULT 'processing',
    "chunks_count" INTEGER DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "document_chunks" (
    "id" SERIAL PRIMARY KEY,
    "document_id" INTEGER NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP DEFAULT NOW(),
    UNIQUE("document_id", "chunk_index")
);
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_idx" ON "document_chunks" USING ivfflat (embedding vector_cosine_ops);

-- Update user_preferences (if table existed but columns missing)
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "custom_prompt" TEXT;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "prompt_style" VARCHAR(50) DEFAULT 'professional';
-- data_sources already in create table default

-- From 0006_workflow_templates
CREATE TABLE IF NOT EXISTS "workflow_templates" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "icon" VARCHAR(50),
    "template" JSONB NOT NULL,
    "parameters" JSONB DEFAULT '[]',
    "is_public" BOOLEAN DEFAULT true,
    "created_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

-- From 0007_auth_and_persistence
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login" TIMESTAMP;

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

ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "state" JSONB;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "paused_at" TIMESTAMP;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "resumed_at" TIMESTAMP;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "can_resume" BOOLEAN DEFAULT true;

-- From 0008 Chat History (New)
CREATE TABLE IF NOT EXISTS "chat_sessions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "session_id" UUID REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP DEFAULT NOW()
);
