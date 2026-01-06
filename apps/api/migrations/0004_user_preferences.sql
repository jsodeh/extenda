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
