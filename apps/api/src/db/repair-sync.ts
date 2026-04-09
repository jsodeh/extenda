import { sql } from 'drizzle-orm';
import { db } from './index.js';

/**
 * Manual repair script to synchronize the database schema with the application's expected state.
 * This is used to fix migration collisions or missed columns in production (Neon).
 */
export async function repairDatabaseSync() {
    console.log('Starting manual database repair sync...');

    try {
        // Essential columns for the users table
        const repairQueries = [
            sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'free'`,
            sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT`,
            sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT`,
            sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false`,
            sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`,
            sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false`,
            sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb`
        ];

        for (const query of repairQueries) {
            try {
                await db.execute(query);
            } catch (err) {
                // Silently ignore errors for individual columns if they already exist 
                // (though IF NOT EXISTS should handle most)
                console.log(`Note: Repair for a column might have skipped: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }

        console.log('Database repair sync completed successfully.');
    } catch (error) {
        console.error('Critical failure during database repair sync:', error);
        // We don't want to crash the whole server, so we just log it
    }
}
