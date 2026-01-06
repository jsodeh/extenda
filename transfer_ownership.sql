-- Transfer ownership of database to extenda
ALTER DATABASE extenda OWNER TO extenda;

-- Transfer ownership of all existing tables to extenda
ALTER TABLE users OWNER TO extenda;
ALTER TABLE workflows OWNER TO extenda;
ALTER TABLE executions OWNER TO extenda;
ALTER TABLE step_executions OWNER TO extenda;
ALTER TABLE chat_sessions OWNER TO extenda;
ALTER TABLE chat_messages OWNER TO extenda;
ALTER TABLE audit_logs OWNER TO extenda;
ALTER TABLE documents OWNER TO extenda;
ALTER TABLE model_configs OWNER TO extenda;

-- Grant all privileges on schema
GRANT ALL ON SCHEMA public TO extenda;

-- Grant all privileges on all sequences in public schema (so extenda can use ID sequences)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO extenda;

-- Grant all privileges on all tables (for any future tables)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO extenda;
