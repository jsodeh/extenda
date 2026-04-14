import { Hono } from 'hono';
import { PreferencesService } from '../services/preferences-service.js';
import { authMiddleware, AuthEnv } from '../lib/auth.js';

const preferences = new Hono<AuthEnv>();

// Apply auth middleware to all routes in this router
preferences.use('*', authMiddleware);

/**
 * GET /api/preferences
 * Get user preferences
 */
preferences.get('/', async (c) => {
    try {
        const dbUser = c.get('user');
        const userId = dbUser.id;

        const prefs = await PreferencesService.get(userId);

        if (!prefs) {
            // Return defaults if no preferences found
            return c.json({
                dataSources: { history: true, bookmarks: false, tabs: true },
                enabledTools: [],
                toolPermissions: {},
                aiSettings: {},
                customPrompt: null,
                promptStyle: 'professional'
            });
        }

        return c.json(prefs);
    } catch (error) {
        console.error('Error fetching preferences:', error);
        return c.json({ error: 'Failed to fetch preferences' }, 500);
    }
});

/**
 * PUT /api/preferences
 * Update user preferences
 */
preferences.put('/', async (c) => {
    try {
        const dbUser = c.get('user');
        const userId = dbUser.id;

        const body = await c.req.json();

        await PreferencesService.upsert({
            userId,
            dataSources: body.dataSources,
            enabledTools: body.enabledTools,
            toolPermissions: body.toolPermissions,
            aiSettings: body.aiSettings,
            customPrompt: body.customPrompt,
            promptStyle: body.promptStyle
        });

        return c.json({ success: true });
    } catch (error) {
        console.error('Error updating preferences:', error);
        return c.json({ error: 'Failed to update preferences' }, 500);
    }
});

/**
 * PATCH /api/preferences
 * Partially update user preferences
 */
preferences.patch('/', async (c) => {
    try {
        const dbUser = c.get('user');
        const userId = dbUser.id;

        const body = await c.req.json();
        const existing = await PreferencesService.get(userId);

        await PreferencesService.upsert({
            userId,
            dataSources: body.dataSources || existing?.dataSources,
            enabledTools: body.enabledTools || existing?.enabledTools,
            toolPermissions: body.toolPermissions || existing?.toolPermissions,
            aiSettings: body.aiSettings || existing?.aiSettings,
            customPrompt: body.customPrompt !== undefined ? body.customPrompt : existing?.customPrompt,
            promptStyle: body.promptStyle || existing?.promptStyle
        });

        return c.json({ success: true });
    } catch (error) {
        console.error('Error patching preferences:', error);
        return c.json({ error: 'Failed to patch preferences' }, 500);
    }
});

export default preferences;
