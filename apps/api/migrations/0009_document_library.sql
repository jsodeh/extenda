-- Reconcile installations which manually journaled 0008 with the UUID schema still active.
-- 0002 used UUID documents. Preserve that table before creating integer chunk references.
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema=current_schema()
        AND table_name='documents' AND column_name='id' AND data_type='uuid') THEN
        ALTER TABLE documents RENAME TO documents_legacy_uuid;
    END IF;
END $$;

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

-- Databases with the normalized 0005 layout retain their ids and vector index.
ALTER TABLE documents ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN file_type TYPE text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS original bytea;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS legacy_id uuid UNIQUE;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding_model text;
CREATE UNIQUE INDEX IF NOT EXISTS documents_owner_checksum ON documents(user_id, checksum);
CREATE INDEX IF NOT EXISTS documents_owner ON documents(user_id);
CREATE INDEX IF NOT EXISTS chunks_text ON document_chunks USING gin(to_tsvector('simple', content));
DO $$ BEGIN
    IF to_regclass('documents_legacy_uuid') IS NOT NULL THEN
        INSERT INTO documents(user_id, name, file_size, file_type, status, chunks_count, metadata, legacy_id, created_at)
        SELECT user_id, left(filename,255), octet_length(content), 'text/plain', 'ready', 1, metadata, id, created_at
        FROM documents_legacy_uuid WHERE user_id IS NOT NULL ON CONFLICT (legacy_id) DO NOTHING;
        INSERT INTO document_chunks(document_id,chunk_index,content,metadata)
        SELECT d.id, 0, l.content, jsonb_build_object('source','legacy','reindex',true)
        FROM documents_legacy_uuid l JOIN documents d ON d.legacy_id=l.id
        ON CONFLICT (document_id,chunk_index) DO NOTHING;
    END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS tool_permissions jsonb DEFAULT '{}';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS parameters jsonb DEFAULT '[]';
