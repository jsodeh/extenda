-- Add documents table for knowledgebase
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

-- Add document_chunks table for RAG
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

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_idx" 
ON "document_chunks" USING ivfflat (embedding vector_cosine_ops);

-- Update user_preferences to add more fields
ALTER TABLE "user_preferences" 
ADD COLUMN IF NOT EXISTS "custom_prompt" TEXT,
ADD COLUMN IF NOT EXISTS "prompt_style" VARCHAR(50) DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS "data_sources" JSONB DEFAULT '{"history": true, "bookmarks": false, "tabs": true}';
