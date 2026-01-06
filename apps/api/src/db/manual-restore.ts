import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/extenda',
});

async function main() {
    try {
        // 1. Run Migrations
        const migrations = [
            '0003_oauth_credentials.sql',
            '0004_user_preferences.sql',
            // '0005_knowledgebase.sql', // Skipping due to missing vector extension
            '0006_workflow_templates.sql',
            '0007_auth_and_persistence.sql'
        ];

        console.log('Running manual migrations...');
        for (const file of migrations) {
            const filePath = path.join(process.cwd(), 'migrations', file);
            console.log(`Executing ${file}...`);
            const sql = fs.readFileSync(filePath, 'utf8');
            await pool.query(sql);
        }
        console.log('Migrations completed.');

        // 2. Ensure Default User
        console.log('Checking for default user...');
        const userRes = await pool.query('SELECT * FROM users LIMIT 1');
        let userId;

        if (userRes.rows.length === 0) {
            console.log('Creating default user...');
            const insertRes = await pool.query(`
                INSERT INTO users (email, password_hash, name, role) 
                VALUES ('demo@extenda.app', 'placeholder_hash', 'Demo User', 'pro')
                RETURNING id;
            `);
            userId = insertRes.rows[0].id;
        } else {
            userId = userRes.rows[0].id;
        }

        console.log(`DEFAULT_USER_ID: ${userId}`);

    } catch (e) {
        console.error('Error during manual restore:', e);
    } finally {
        await pool.end();
    }
}

main();
