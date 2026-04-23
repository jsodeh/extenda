/**
 * Migration: Add missing columns to workflows table
 * 
 * The Drizzle schema defines category, icon, and parameters on workflows,
 * but the original manual-neon-init.ts never created them.
 * This causes "column X does not exist" errors at runtime.
 */
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL
    || "postgresql://neondb_owner:npg_MwmXt9HGC8EV@ep-silent-shadow-amyzes0k-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

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
