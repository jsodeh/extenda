/**
 * Migration: Add missing columns to workflows table
 * 
 * The Drizzle schema defines category, icon, and parameters on workflows,
 * but the original manual-neon-init.ts never created them.
 * This causes "column X does not exist" errors at runtime.
 */
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set DATABASE_URL explicitly');

const pool = new Pool({ connectionString });

async function migrate() {
    console.log('Adding missing columns to workflows table...');
    try {
        // Add columns only if they don't already exist (idempotent)
        await pool.query(`
            ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "category" TEXT;
            ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "icon" TEXT;
            ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "parameters" JSONB DEFAULT '[]';
        `);
        console.log('✅ Missing columns added successfully.');
    } catch (e) {
        console.error('❌ Migration failed:', (e as Error).message);
    } finally {
        await pool.end();
    }
}

migrate();
