import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface AuthEnv {
    Variables: {
        user: typeof users.$inferSelect;
    };
}

export const authMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized: Missing token' }, 401);
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';

    try {
        const payload = await verify(token, jwtSecret);
        const userId = payload.userId as string;

        if (!userId) {
            return c.json({ error: 'Unauthorized: Invalid token payload' }, 401);
        }

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user) {
            return c.json({ error: 'Unauthorized: User not found' }, 401);
        }

        // Set user in context for downstream routes
        c.set('user', user);
        await next();
    } catch (err) {
        console.error('Auth Middleware Error:', err);
        return c.json({ error: 'Unauthorized: Session expired or invalid' }, 401);
    }
};
