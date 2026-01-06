import { db } from '../db/index.js';
import { documents } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { generateText } from '../lib/gemini.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini for embeddings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

export class KnowledgeBaseService {

    /**
     * Ingest a text document: chunk, embed, and store.
     */
    async ingest(userId: string, filename: string, content: string, metadata: any = {}) {
        console.log(`Ingesting document: ${filename} for user: ${userId}`);

        // 1. Chunking (Simple paragraph split for now, can be improved)
        const chunks = this.chunkText(content, 1000);
        console.log(`Split into ${chunks.length} chunks`);

        for (const chunk of chunks) {
            try {
                // 2. Generate Embedding
                const embeddingResult = await embeddingModel.embedContent(chunk);
                const embedding = embeddingResult.embedding.values;

                // 3. Store in DB
                await db.insert(documents).values({
                    userId,
                    filename,
                    content: chunk,
                    embedding: embedding as any, // Storing as JSON array for now
                    metadata
                });
            } catch (error) {
                console.error('Error embedding chunk:', error);
                // Continue with other chunks
            }
        }
        console.log('Ingestion complete');
    }

    /**
     * Semantic search using cosine similarity (simulated via JS if no pgvector)
     * For true scalability, enable pgvector extension in Postgres.
     */
    async search(userId: string, query: string, limit: number = 3): Promise<string[]> {
        console.log(`Searching knowledge base for: "${query}"`);

        try {
            // 1. Embed query
            const embeddingResult = await embeddingModel.embedContent(query);
            const queryEmbedding = embeddingResult.embedding.values;

            // 2. Fetch all user documents (Inmem search for MVP without pgvector)
            // TODO: partial fetch or use real vector DB in prod
            const userDocs = await db.query.documents.findMany({
                where: eq(documents.userId, userId as any)
            });

            if (userDocs.length === 0) return [];

            // 3. Calculate similarity
            const scoredDocs = userDocs.map(doc => ({
                content: doc.content,
                score: this.cosineSimilarity(queryEmbedding, doc.embedding as number[])
            }));

            // 4. Sort and return top K
            scoredDocs.sort((a, b) => b.score - a.score);

            return scoredDocs.slice(0, limit).map(d => d.content);

        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }

    private chunkText(text: string, maxLength: number): string[] {
        const chunks: string[] = [];
        let currentChunk = '';

        const sentences = text.split(/(?<=[.!?])\s+/);

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > maxLength) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }
        if (currentChunk) chunks.push(currentChunk.trim());

        return chunks;
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

        return dotProduct / (magnitudeA * magnitudeB);
    }
}

export const knowledgeBase = new KnowledgeBaseService();
