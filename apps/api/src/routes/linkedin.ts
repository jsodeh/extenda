import { Hono } from 'hono';
import { authMiddleware, AuthEnv } from '../lib/auth.js';
import { approvalDigest } from '../lib/approval.js';
import { drafts, editDraft, linkedAccount, preparePost, queuePost } from '../services/linkedin.js';
import { executeDueJobs } from '../services/scheduler.js';
import { pool } from '../db/index.js';

const router = new Hono<AuthEnv>();
router.use('*', authMiddleware);
router.onError((_, c) => c.json({ error: 'Draft or account changed. Reload before continuing.' }, 409));
router.get('/', async (c) => {
    const owner = c.get('user').id;
    const account = await linkedAccount(owner);
    return c.json({drafts:await drafts(owner), author:account?.author || null, accountBinding:account?.binding || null});
});
router.put('/:id', async (c) => {
    const body = await c.req.json();
    await editDraft(c.get('user').id, c.req.param('id'), body.version, body);
    return c.json({ saved: true });
});
router.post('/:id/approve', async (c) => {
    const owner = c.get('user').id,
        id = c.req.param('id'),
        body = await c.req.json();
    const post = await preparePost(owner, { draftId: id, at: body.at, timezone: body.timezone });
    if (
        !post.author ||
        body.author !== post.author || body.accountBinding !== post.accountBinding ||
        body.version !== post.version ||
        body.text !== post.text ||
        body.visibility !== post.visibility ||
        (body.link || null) !== post.link
    )
        return c.json({ error: 'Approval no longer matches current content or destination' }, 409);
    const key = id + '/' + post.version;
    const proof = approvalDigest(owner, key, { id, tool: 'linkedin', params: post });
    const job = await queuePost(owner, post, key, proof);
    if (!post.at) await executeDueJobs(1, String(job.id));
    const {
        rows: [result]
    } = await pool.query('SELECT status,result FROM scheduled_jobs WHERE user_id=$1 AND id=$2', [owner, job.id]);
    return c.json(result);
});
export default router;
