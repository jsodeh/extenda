import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth.js';

const config = new Hono();
config.get('/voice', authMiddleware, (c) => c.json({
    provider: 'google',
    credentialSource: 'byok'
}));
export default config;
