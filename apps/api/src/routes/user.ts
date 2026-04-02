import { Hono } from 'hono';
import { verifyClerkToken, clerkClient } from '../lib/clerk.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const user = new Hono();

/**
 * GET /api/user/export
 */
user.get('/export', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const token = authHeader.substring(7);
        const payload = await verifyClerkToken(token);
        const clerkUserId = payload.sub;

        if (!clerkUserId) return c.json({ error: 'Invalid token' }, 401);

        // Get user from our DB
        const dbUser = await db.query.users.findFirst({
            where: eq(users.clerkId, clerkUserId)
        });

        if (!dbUser) return c.json({ error: 'User not found in local database' }, 404);

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
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const token = authHeader.substring(7);
        const payload = await verifyClerkToken(token);
        const clerkUserId = payload.sub;

        if (!clerkUserId) return c.json({ error: 'Invalid token' }, 401);

        // Get user from our DB
        const dbUser = await db.query.users.findFirst({
            where: eq(users.clerkId, clerkUserId)
        });

        if (!dbUser) return c.json({ error: 'User not found' }, 404);

        // Cascade delete all user data locally
        await deleteUserAccount(dbUser.id);

        // Also delete from Clerk
        await clerkClient.users.deleteUser(clerkUserId);

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
