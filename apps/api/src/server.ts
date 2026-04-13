// Load environment variables before importing routes
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware, AuthEnv } from './lib/auth.js';
import { oauth } from './routes/oauth.js';
import { authOAuth } from './routes/auth-oauth.js';
import preferences from './routes/preferences.js';
import templates from './routes/templates.js';
import user from './routes/user.js';
import knowledge from './routes/knowledge.js';
import { vision } from './routes/vision.js';
import config from './routes/config.js';

import sync from './routes/sync.js';

const app = new Hono<AuthEnv>();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => c.text('Extenda API'));
app.get('/health', (c) => c.json({ status: 'ok' }));

// Mount routes
// app.route('/api/auth', auth); // DELETED: Moving to Clerk
app.route('/api/user', user);
app.route('/oauth', oauth);
app.route('/oauth/auth', authOAuth);
app.route('/api/preferences', preferences);
app.route('/api/templates', templates);
app.route('/knowledge', knowledge);
app.route('/vision', vision);
app.route('/api/config', config);
app.route('/api/sync', sync);

export default app;
