import pg from 'pg';
const { Pool } = pg;

const connectionString = "postgresql://neondb_owner:npg_MwmXt9HGC8EV@ep-silent-shadow-amyzes0k-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const pool = new Pool({ connectionString });

async function init() {
    console.log('Initializing Neon database schema...');
    try {
        const sql = `
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            CREATE EXTENSION IF NOT EXISTS "vector";

            CREATE TABLE IF NOT EXISTS "users" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "email" TEXT NOT NULL UNIQUE,
                "password_hash" TEXT NOT NULL,
                "name" TEXT,
                "role" TEXT DEFAULT 'free',
                "google_access_token" TEXT,
                "google_refresh_token" TEXT,
                "settings" JSONB DEFAULT '{}',
                "email_verified" BOOLEAN DEFAULT false,
                "last_login" TIMESTAMP,
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS "model_configs" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
                "name" TEXT NOT NULL,
                "provider" TEXT NOT NULL,
                "model" TEXT NOT NULL,
                "api_key_encrypted" TEXT,
                "endpoint" TEXT,
                "priority" INTEGER DEFAULT 1,
                "settings" JSONB DEFAULT '{}',
                "created_at" TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS "workflows" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
                "name" TEXT NOT NULL,
                "description" TEXT,
                "intent" TEXT NOT NULL,
                "definition" JSONB NOT NULL,
                "is_template" BOOLEAN DEFAULT false,
                "is_public" BOOLEAN DEFAULT false,
                "version" INTEGER DEFAULT 1,
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS "executions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "workflow_id" UUID REFERENCES "workflows"("id") ON DELETE CASCADE,
                "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
                "status" TEXT NOT NULL,
                "started_at" TIMESTAMP DEFAULT NOW(),
                "completed_at" TIMESTAMP,
                "context" JSONB NOT NULL,
                "result" JSONB,
                "error" JSONB
            );

            CREATE TABLE IF NOT EXISTS "documents" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
                "filename" TEXT NOT NULL,
                "content" TEXT NOT NULL,
                "embedding" vector(768),
                "metadata" JSONB DEFAULT '{}',
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW()
            );

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

            CREATE TABLE IF NOT EXISTS "user_preferences" (
                "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
                "data_sources" JSONB DEFAULT '{}',
                "enabled_tools" JSONB DEFAULT '[]',
                "ai_settings" JSONB DEFAULT '{}',
                "custom_prompt" TEXT,
                "prompt_style" TEXT DEFAULT 'professional',
                "updated_at" TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS "oauth_credentials" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE NOT NULL,
                "provider" TEXT NOT NULL,
                "encrypted_access_token" TEXT NOT NULL,
                "encrypted_refresh_token" TEXT,
                "expires_at" TIMESTAMP,
                "scope" TEXT,
                "metadata" JSONB DEFAULT '{}',
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW(),
                UNIQUE ("user_id", "provider")
            );
        `;
        await pool.query(sql);
        console.log('✅ All tables successfully created on Neon.');
    } catch (e) {
        console.error('❌ Migration failed:', (e as Error).message);
    } finally {
        await pool.end();
    }
}

init();
