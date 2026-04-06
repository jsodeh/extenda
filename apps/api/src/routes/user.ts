import { Hono } from 'hono';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware, AuthEnv } from '../lib/auth.js';

const user = new Hono<AuthEnv>();

// Apply auth middleware to all routes in this router
user.use('*', authMiddleware);

/**
 * GET /api/user/export
 */
user.get('/export', async (c) => {
    try {
        const dbUser = c.get('user');
        const userId = dbUser.id;

        // Export all user data
        const data = {
            user: await getUserData(userId),
            workflows: await getUserWorkflows(userId),
            executions: await getUserExecutions(userId),
            preferences: await getUserPreferences(userId),
            oauthConnections: await getUserOAuthConnections(userId),
            exportedAt: new Date().toISOString()
        };

        return c.json(data);
    } catch (error) {
        console.error('Data export error:', error);
        return c.json({ error: 'Export failed or unauthorized' }, 500);
    }
});

/**
 * DELETE /api/user/account
 */
user.delete('/account', async (c) => {
    try {
        const dbUser = c.get('user');

        // Cascade delete all user data locally
        await deleteUserAccount(dbUser.id);

        return c.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        return c.json({ error: 'Deletion failed' }, 500);
    }
});

// Helper functions (implement these based on your schema)
async function getUserData(userId: string) {
    return db.query.users.findFirst({ where: eq(users.id, userId as any) });
}

async function getUserWorkflows(userId: string) { return []; }
async function getUserExecutions(userId: string) { return []; }
async function getUserPreferences(userId: string) { return {}; }
async function getUserOAuthConnections(userId: string) { return []; }

async function deleteUserAccount(userId: string) {
    await db.delete(users).where(eq(users.id, userId as any));
}

export default user;
