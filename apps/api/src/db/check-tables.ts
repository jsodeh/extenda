import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/extenda',
});

async function main() {
    try {
        const res = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public';");
        console.log('Tables:', res.rows.map(r => r.tablename));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
