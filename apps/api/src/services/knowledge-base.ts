import { createHash, randomUUID } from 'node:crypto';
import { db, pool } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { chunksOf, extractSections, validateFile } from './file-processor.js';
import { embedContent } from '../lib/models.js';

const embeddingModel = () => process.env.KNOWLEDGE_EMBEDDING_MODEL || 'text-embedding-3-small';
async function embed(text: string) {
    const apiKey = process.env.KNOWLEDGE_OPENAI_KEY;
    if (!apiKey) throw new Error('Semantic indexing is unavailable');
    const values = await embedContent(text, { provider: 'openai', model: embeddingModel(), apiKey });
    if (values.length !== 1536 || !values.every(Number.isFinite)) throw new Error('Invalid embedding dimensions');
    return JSON.stringify(values);
}

const projection = 'id,name,file_size AS size,status,metadata,created_at AS "uploadedAt",original IS NOT NULL AS "hasOriginal"';

export class KnowledgeBaseService {
    async list(owner: string) {
        return (await pool.query(`SELECT ${projection} FROM documents WHERE user_id=$1 ORDER BY created_at DESC`, [owner])).rows;
    }

    async upload(owner: string, name: string, bytes: Buffer, semantic: boolean, replace?: number) {
        const type = validateFile(name, bytes);
        const hash = createHash('sha256').update(bytes).digest('hex');
        const generation = randomUUID();
        const meta = { generation, semantic };
        const args = [owner,name,type,bytes.length,bytes,hash,meta];
        const { rows } = replace
            ? await pool.query(`UPDATE documents SET name=$2,file_type=$3,file_size=$4,original=$5,checksum=$6,
                metadata=$7,status='processing',updated_at=now() WHERE user_id=$1 AND id=$8 RETURNING id`, [...args, replace])
            : await pool.query(`INSERT INTO documents(user_id,name,file_type,file_size,original,checksum,metadata)
                VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,checksum) DO NOTHING RETURNING id`, args);
        if (!rows.length) {
            if (replace) throw new Error('Document unavailable');
            return (await pool.query(`SELECT ${projection} FROM documents WHERE user_id=$1 AND checksum=$2`, [owner,hash])).rows[0];
        }
        const id = rows[0].id as number;
        try {
            const chunks = chunksOf(await extractSections(name, bytes));
            const vectors: (string | null)[] = [];
            for (const chunk of chunks) vectors.push(semantic ? await embed(chunk.text) : null);
            await db.transaction(async tx => {
                const locked = await tx.execute(sql`SELECT id FROM documents WHERE id=${id} AND user_id=${owner}
                    AND metadata->>'generation'=${generation} FOR UPDATE`);
                if (!locked.rowCount) throw new Error('Document changed during processing');
                await tx.execute(sql`DELETE FROM document_chunks WHERE document_id=${id}`);
                for (let i=0; i<chunks.length; i++) {
                    await tx.execute(sql`INSERT INTO document_chunks(document_id,chunk_index,content,metadata,embedding,embedding_model)
                        VALUES(${id},${i},${chunks[i].text},${JSON.stringify({ source: chunks[i].source })}::jsonb,
                        ${vectors[i]}::vector,${semantic ? embeddingModel() : null})`);
                }
                await tx.execute(sql`UPDATE documents SET status='ready',chunks_count=${chunks.length},updated_at=now() WHERE id=${id}`);
            });
        } catch (error) {
            const message = error instanceof Error && /^(No readable|Missing or oversized|Invalid|Expected|Extracted|PDF exceeds|Semantic indexing)/.test(error.message)
                ? error.message : 'Extraction or indexing failed. Retry or replace this file.';
            await pool.query(`UPDATE documents SET status='failed',metadata=metadata || $3::jsonb
                WHERE id=$1 AND user_id=$2 AND metadata->>'generation'=$4`, [id,owner,{ error: message },generation]);
        }
        return (await pool.query(`SELECT ${projection} FROM documents WHERE id=$1 AND user_id=$2`,[id,owner])).rows[0];
    }

    async original(owner: string, id: number) {
        return (await pool.query('SELECT name,file_type,original,metadata,checksum FROM documents WHERE user_id=$1 AND id=$2',[owner,id])).rows[0];
    }

    async preview(owner: string, id: number) {
        return (await pool.query(`SELECT c.content,c.metadata FROM document_chunks c JOIN documents d ON d.id=c.document_id
            WHERE d.user_id=$1 AND d.id=$2 AND d.status='ready' ORDER BY c.chunk_index`,[owner,id])).rows;
    }

    async remove(owner: string, id: number) {
        return db.transaction(async tx => {
            const result = await tx.execute(sql`DELETE FROM documents WHERE user_id=${owner} AND id=${id} RETURNING legacy_id`);
            if (result.rows[0]?.legacy_id) await tx.execute(sql`DELETE FROM documents_legacy_uuid WHERE user_id=${owner} AND id=${result.rows[0].legacy_id}`);
            return !!result.rowCount;
        });
    }

    async search(owner: string, query: string, limit = 5) {
        const terms = query.toLowerCase().match(/[\p{L}\p{N}@.-]{2,}/gu) || [];
        const keywords = terms.filter(w => !/^(what|are|my|the|and|from|for|this|use|can|with|your|please|based|that|about|into|have|how|does)$/.test(w));
        if (/\b(cv|resume|qualification|experience|career|skills?|application)\b/i.test(query) || /qualifications|experiences/i.test(query)) keywords.push('education','experience','degree','skills','employment','university','cv','resume');
        if (!keywords.length) return [];
        const eligible = process.env.KNOWLEDGE_OPENAI_KEY && (await pool.query(
            "SELECT 1 FROM documents WHERE user_id=$1 AND status='ready' AND metadata->>'semantic'='true' LIMIT 1",[owner])).rowCount;
        const vector = eligible ? await embed(query).catch(() => null) : null;
        const { rows } = await pool.query(`WITH ranked AS (
            SELECT d.id,d.name,c.content,c.metadata->>'source' AS source,c.chunk_index,
            (SELECT count(*) FROM unnest($2::text[]) k WHERE position(k in lower(d.name || ' ' || c.content))>0) AS hits,
            CASE WHEN c.embedding_model=$4 THEN 1-(c.embedding <=> $3::vector) ELSE 0 END AS similarity
            FROM document_chunks c JOIN documents d ON c.document_id=d.id WHERE d.user_id=$1 AND d.status='ready')
            SELECT * FROM ranked WHERE hits>0 OR similarity>0.35 ORDER BY hits+coalesce(similarity,0) DESC,chunk_index LIMIT $5`,
            [owner,[...new Set(keywords)].slice(0,60),vector,embeddingModel(),limit]);
        const confirmed = await pool.query(`SELECT name, metadata->>'facts' AS facts FROM documents
            WHERE user_id=$1 AND status='ready' AND length(metadata->>'facts')>0 AND
            (name=ANY($2::text[]) OR EXISTS (SELECT FROM unnest($3::text[]) k WHERE position(k in lower(metadata->>'facts'))>0))
            ORDER BY updated_at DESC LIMIT 3`,[owner,rows.map(r=>r.name),keywords]);
        return [...confirmed.rows.map(r=>`[Confirmed profile, ${r.name}] ${r.facts.slice(0,3000)}`), ...rows.map(r => `[${r.name}, ${r.source || 'chunk ' + (r.chunk_index+1)}] ${r.content}`)];
    }
}
export const knowledgeBase = new KnowledgeBaseService();
