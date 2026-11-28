import '../env.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let migrationInProgress: Promise<void> | undefined;
export function runMigrations() {
    return migrationInProgress ??= applyMigrations().finally(() => { migrationInProgress = undefined; });
}
async function applyMigrations() {
    console.log('Running migrations...');
    // Dist: apps/api/dist/db/migrate.js -> Migrations: apps/api/migrations
    const migrationsFolder = resolve(__dirname, '../../migrations');
    console.log(`Using migrations folder: ${migrationsFolder}`);

    // Keep the lock transaction open on a separate connection while Drizzle reads its
    // journal and commits DDL. This also works with transaction-pooled PostgreSQL.
    const lock = await pool.connect();
    try {
        await lock.query('BEGIN');
        await lock.query("SET LOCAL lock_timeout = '2min'");
        await lock.query("SELECT pg_advisory_xact_lock(98104327, 1)");
        await migrate(db, { migrationsFolder });
    } finally {
        try { await lock.query('ROLLBACK'); } finally { lock.release(); }
    }
    console.log('Migrations completed.');
}

// ESM check for direct execution
if (process.argv[1] === __filename) {
    runMigrations().finally(() => pool.end()).catch((err) => {
        console.error('Migration failed');
        process.exit(1);
    });
}
