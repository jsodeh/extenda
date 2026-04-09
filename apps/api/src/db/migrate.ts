import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations() {
    console.log('Running migrations...');
    // Dist: apps/api/dist/db/migrate.js -> Migrations: apps/api/migrations
    const migrationsFolder = resolve(__dirname, '../../migrations');
    console.log(`Using migrations folder: ${migrationsFolder}`);

    try {
        await migrate(db, { migrationsFolder });
        console.log('Migrations completed.');
    } catch (error) {
        console.warn('Migration warning (expected during schema transition):', error);
        console.log('Continuing server startup...');
    }
}

// ESM check for direct execution
if (process.argv[1] === __filename) {
    runMigrations().catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
}
