/**
 * Config routes - provides client configuration from server environment
 */

import { Hono } from 'hono';

const config = new Hono();

/**
 * GET /config/voice - Returns Gemini API key for voice features
 * Only returns to authenticated users
 */
config.get('/voice', async (c) => {
    // Get authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // Return the Gemini API key from environment
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
        return c.json({ error: 'Voice features not configured' }, 503);
    }

    return c.json({
        geminiApiKey,
        model: 'gemini-2.0-flash-exp'
    });
});

export default config;
