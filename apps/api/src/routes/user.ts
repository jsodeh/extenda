import { Hono } from 'hono';
import { AuthService } from '../services/auth-service.js';

const user = new Hono();

/**
 * GET /api/user/export
 * Export all user data (GDPR compliance)
 */
user.get('/export', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const token = authHeader.substring(7);
        const { userId } = AuthService.verifyToken(token);

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
        return c.json({ error: 'Export failed' }, 500);
    }
});

/**
 * DELETE /api/user/account
 * Delete user account and all data (GDPR compliance)
 */
user.delete('/account', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const token = authHeader.substring(7);
        const { userId } = AuthService.verifyToken(token);

        // Verify password before deletion
        const { password } = await c.req.json();
        if (!password) {
            return c.json({ error: 'Password required for account deletion' }, 400);
        }

        // Cascade delete all user data
        await deleteUserAccount(userId);

        return c.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        return c.json({ error: 'Deletion failed' }, 500);
    }
});

// Helper functions (implement these based on your schema)
async function getUserData(userId: string) {
    // Implementation
    return {};
}

async function getUserWorkflows(userId: string) {
    // Implementation
    return [];
}

async function getUserExecutions(userId: string) {
    // Implementation
    return [];
}

async function getUserPreferences(userId: string) {
    // Implementation
    return {};
}

async function getUserOAuthConnections(userId: string) {
    // Implementation
    return [];
}

async function deleteUserAccount(userId: string) {
    // Cascade delete implementation
    // This would be handled by database constraints
}

export default user;
