import { it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

// Each legacy fixture gets its own database and Drizzle journal.
for (const layout of ['uuid', 'integer'])
    it(
        'preserves ' + layout + ' legacy documents and vectors',
        { skip: !process.env.TEST_DATABASE_URL },
        async () => {
            const url = new URL(process.env.TEST_DATABASE_URL!);
            const admin = new Pool({ connectionString: url.href });
            const name = 'extenda_fixture_' + randomUUID().replaceAll('-', '');
            await admin.query('CREATE DATABASE ' + name);
            url.pathname = '/' + name;
            const fixture = new Pool({ connectionString: url.href });
            const migration = (tag: string) =>
                readFile(new URL('../../../migrations/' + tag + '.sql', import.meta.url), 'utf8');
            try {
                await fixture.query(await migration('0000_tiny_sasquatch'));
                const owner = randomUUID();
                await fixture.query(
                    "INSERT INTO users(id,email,password_hash) VALUES($1,'fixture@example.test','fixture')",
                    [owner]
                );
                if (layout === 'uuid') {
                    await fixture.query(await migration('0002_milky_random'));
                    await fixture.query(
                        "INSERT INTO documents(user_id,filename,content,embedding) VALUES($1,'cv.txt','Old qualification','[0.5,0.5]')",
                        [owner]
                    );
                } else {
                    await fixture.query('CREATE EXTENSION vector');
                    await fixture.query(await migration('0004_user_preferences'));
                    await fixture.query(await migration('0005_knowledgebase'));
                    const {
                        rows: [d]
                    } = await fixture.query(
                        "INSERT INTO documents(user_id,name,file_path,file_size,file_type,status) VALUES($1,'cv.txt','old/path',16,'text/plain','ready') RETURNING id",
                        [owner]
                    );
                    await fixture.query(
                        "INSERT INTO document_chunks(document_id,chunk_index,content,embedding) VALUES($1,0,'Old qualification',$2::vector)",
                        [d.id, JSON.stringify(Array(1536).fill(0.5))]
                    );
                }
                await fixture.query(await migration('0008_schema_sync'));
                await fixture.query(await migration('0009_document_library'));
                await fixture.query(await migration('0009_document_library'));
                const { rows } = await fixture.query(
                    'SELECT d.user_id,c.content,c.embedding FROM documents d JOIN document_chunks c ON c.document_id=d.id'
                );
                assert.equal(rows.length, 1);
                assert.equal(rows[0].user_id, owner);
                assert.equal(rows[0].content, 'Old qualification');
                if (layout === 'uuid')
                    assert.deepEqual(
                        (await fixture.query('SELECT embedding FROM documents_legacy_uuid')).rows[0].embedding,
                        [0.5, 0.5]
                    );
                else assert.equal(JSON.parse(rows[0].embedding).length, 1536);
            } finally {
                await fixture.end();
                await admin.query('DROP DATABASE ' + name);
                await admin.end();
            }
        }
    );
