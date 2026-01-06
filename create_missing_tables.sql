-- Create missing tables

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_sources JSONB DEFAULT '{}',
    enabled_tools JSONB DEFAULT '[]',
    ai_settings JSONB DEFAULT '{}',
    custom_prompt TEXT,
    prompt_style TEXT DEFAULT 'professional',
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    expires_at TIMESTAMP,
    scope TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

-- Transfer ownership to extenda user
ALTER TABLE user_preferences OWNER TO extenda;
ALTER TABLE oauth_credentials OWNER TO extenda;

-- Grant privileges
GRANT ALL PRIVILEGES ON TABLE user_preferences TO extenda;
GRANT ALL PRIVILEGES ON TABLE oauth_credentials TO extenda;
