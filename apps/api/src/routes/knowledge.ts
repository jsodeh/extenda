import { Hono } from 'hono';
import { knowledgeBase } from '../services/knowledge-base.js';
import { users } from '../db/schema.js';
import { db } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { AuthService } from '../services/auth-service.js';
import { User } from '@extenda/shared';

type Variables = {
    user: User;
}

const knowledge = new Hono<{ Variables: Variables }>();

// Middleware to verify token for HTTP requests (simplified from socket)
knowledge.use('*', async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'No token provided' }, 401);

    const token = authHeader.split(' ')[1];
    try {
        const { userId } = AuthService.verifyToken(token);
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId as any)
        });

        if (!user) return c.json({ error: 'User not found' }, 401);

        c.set('user', user as any); // Cast as DB user might differ slightly from Shared User or just to be safe
        await next();
    } catch (err) {
        return c.json({ error: 'Invalid token' }, 401);
    }
});

knowledge.post('/upload', async (c) => {
    const user = c.get('user');
    try {
        const body = await c.req.parseBody();
        const file = body['file'] as File;

        if (!file) {
            return c.json({ error: 'No file uploaded' }, 400);
        }

        const content = await file.text();

        // Ingest: Chunk -> Embed -> Store
        await knowledgeBase.ingest(user.id, file.name, content);

        return c.json({ success: true, message: `File ${file.name} processed` });
    } catch (error) {
        console.error('Upload error:', error);
        return c.json({ error: 'Failed to process file' }, 500);
    }
});

export default knowledge;
