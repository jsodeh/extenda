import { it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sign } from 'hono/jwt';

it('migrates a fixture database and isolates originals, indexing, replacement and deletion', { skip: !process.env.TEST_DATABASE_URL }, async () => {
    process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET=randomUUID();
    const { runMigrations }=await import('../../db/migrate.js');
    const { pool }=await import('../../db/index.js');
    const router=(await import('../../routes/knowledge.js')).default;
    const owner=randomUUID(), other=randomUUID();
    try {
        await runMigrations(); await runMigrations();
        for (const id of [owner,other]) await pool.query('INSERT INTO users(id,email) VALUES($1,$2)',[id,id+'@example.test']);
        const headers=async (id:string)=>({authorization:'Bearer '+await sign({userId:id},process.env.JWT_SECRET!)});
        const form=new FormData(); form.set('file',new File(['Education: MSc in fixture science'],'cv.txt'));
        assert.equal((await router.request('/upload',{method:'POST',body:form})).status,401);
        const upload=await router.request('/upload',{method:'POST',headers:await headers(owner),body:form});
        assert.equal(upload.status,200);
        const doc=await upload.json() as any;
        assert.equal(doc.status,'ready');
        assert.equal((await (await router.request('/',{headers:await headers(owner)})).json() as any[]).length,1);
        assert.match(await (await router.request('/search?q=qualifications',{headers:await headers(owner)})).text(),/MSc/);
        assert.equal(await (await router.request('/search?q=qualifications',{headers:await headers(other)})).text(),'[]');
        const original='/'+doc.id+'/download';
        assert.equal((await router.request(original,{headers:await headers(other)})).status,404);
        assert.equal(await (await router.request(original,{headers:await headers(owner)})).text(),'Education: MSc in fixture science');
        form.set('replace',String(doc.id)); form.set('file',new File(['Experience: Fixture Inc'],'revised.txt'));
        assert.equal((await router.request('/upload',{method:'POST',body:form,headers:await headers(owner)})).status,200);
        assert.equal((await router.request('/'+doc.id,{method:'DELETE',headers:await headers(other)})).status,404);
        assert.equal((await router.request('/'+doc.id,{method:'DELETE',headers:await headers(owner)})).status,200);
        assert.equal((await pool.query('SELECT 1 FROM document_chunks WHERE document_id=$1',[doc.id])).rowCount,0);
    } finally { await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[owner,other]]); await pool.end(); }
});
