import './env.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { allowedExtensionOrigin, AuthEnv } from './lib/auth.js';
import { oauth } from './routes/oauth.js';
import { authOAuth } from './routes/auth-oauth.js';
import preferences from './routes/preferences.js';
import templates from './routes/templates.js';
import user from './routes/user.js';
import voiceTools from './routes/voice-tools.js';
import linkedin from './routes/linkedin.js';
import schedule from './routes/schedule.js';
import knowledge from './routes/knowledge.js';
import { vision } from './routes/vision.js';
import config from './routes/config.js';

import sync from './routes/sync.js';

const app = new Hono<AuthEnv>();

app.use('*', cors({origin: origin=>allowedExtensionOrigin(origin) ? origin : '',allowHeaders:['Content-Type','Authorization'],allowMethods:['GET','POST','PUT','PATCH','DELETE','OPTIONS']}));
app.use('*',async(c,next)=>{await next(); console.info(c.req.method,c.req.path.split('/').slice(0,3).join('/'),c.res.status);});
// Detailed CORS handled in index.ts for better control

app.get('/', (c) => c.text('Extenda API'));
app.get('/health', (c) => c.json({ status: 'ok' }));

// Mount routes
// app.route('/api/auth', auth); // DELETED: Moving to Clerk
app.route('/api/user', user);
app.route('/oauth', oauth);
app.route('/oauth/auth', authOAuth);
app.route('/api/preferences', preferences);
app.route('/api/templates', templates);
app.route('/api/voice-tools',voiceTools);
app.route('/api/linkedin',linkedin);
app.route('/api/schedule',schedule);
app.route('/api/knowledge', knowledge);
app.route('/knowledge', knowledge);
app.route('/vision', vision);
app.route('/api/config', config);
app.route('/api/sync', sync);

export default app;
