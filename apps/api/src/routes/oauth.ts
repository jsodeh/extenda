import { getCookie,setCookie,deleteCookie } from 'hono/cookie';
import { pool } from '../db/index.js';
import { Hono } from 'hono';
import { oauthManager } from '../services/oauth-manager.js';
import crypto from 'crypto';
import { authMiddleware, AuthEnv } from '../lib/auth.js';

const oauth = new Hono<AuthEnv>();

interface OAuthProvider {
    authUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    redirectUri: string;
}

const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
    linkedin:{
        authUrl:'https://www.linkedin.com/oauth/v2/authorization',tokenUrl:'https://www.linkedin.com/oauth/v2/accessToken',
        clientId:process.env.LINKEDIN_CLIENT_ID || '',clientSecret:process.env.LINKEDIN_CLIENT_SECRET || '',
        scopes:['openid','profile','w_member_social'],redirectUri:process.env.LINKEDIN_INTEGRATION_REDIRECT_URI || 'http://localhost:3000/oauth/callback/linkedin'
    },
    google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
        scopes: [
            'openid',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/drive.file'
        ],
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback/google'
    },
    slack: {
        authUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        clientId: process.env.SLACK_CLIENT_ID || '',
        clientSecret: process.env.SLACK_CLIENT_SECRET || '',
        scopes: ['channels:read', 'chat:write', 'users:read', 'files:read'],
        redirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:3000/oauth/callback/slack'
    },
    jira: {
        authUrl: 'https://auth.atlassian.com/authorize',
        tokenUrl: 'https://auth.atlassian.com/oauth/token',
        clientId: process.env.JIRA_CLIENT_ID || '',
        clientSecret: process.env.JIRA_CLIENT_SECRET || '',
        scopes: ['read:jira-work', 'write:jira-work'],
        redirectUri: process.env.JIRA_REDIRECT_URI || 'http://localhost:3000/oauth/callback/jira'
    }
};

/**
 * GET /oauth/authorize/:provider
 * Initiate OAuth flow by redirecting to provider's authorization page
 */
oauth.post('/authorize/:provider',authMiddleware,async c=>{
    const provider=c.req.param('provider'),config=OAUTH_PROVIDERS[provider];
    if (!Object.hasOwn(OAUTH_PROVIDERS,provider) || !config?.clientId || !config.clientSecret) return c.json({error:'Provider credentials unavailable'},400);
    const state=crypto.randomUUID();
    await pool.query('DELETE FROM oauth_link_states WHERE expires_at<now()');
    await pool.query('INSERT INTO oauth_link_states(nonce,user_id,provider) VALUES($1,$2,$3)',[state,c.get('user').id,provider]);
    return c.json({path:'/oauth/start/'+state});
});
oauth.get('/start/:nonce',async c=>{
    const state=c.req.param('nonce');
    const {rows:[link]}=await pool.query('SELECT provider FROM oauth_link_states WHERE nonce=$1 AND expires_at>now()',[state]);
    if (!link) return c.json({error:'Connection expired'},400);
    const config=OAUTH_PROVIDERS[link.provider];
    setCookie(c,'oauth_link',state,{httpOnly:true,secure:new URL(c.req.url).protocol==='https:',sameSite:'Lax',path:'/oauth',maxAge:600});
    // Build authorization URL
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state,
        ...(link.provider==='google'?{access_type:'offline',prompt:'consent'}:{})
    });

    return c.redirect(`${config.authUrl}?${params.toString()}`);
});

/**
 * GET /oauth/callback/:provider
 * Handle OAuth callback and exchange code for token
 */
oauth.get('/callback/:provider', async (c) => {
    const provider = c.req.param('provider') as keyof typeof OAUTH_PROVIDERS;
    const config = OAUTH_PROVIDERS[provider];

    if (!config) {
        return c.json({ error: 'Invalid provider' }, 400);
    }

    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (!state || getCookie(c,'oauth_link')!==state) return c.json({error:'Invalid OAuth state'},400);
    deleteCookie(c,'oauth_link',{path:'/oauth'});
    const {rows:[link]}=await pool.query('SELECT user_id FROM oauth_link_states WHERE nonce=$1 AND provider=$2 AND expires_at>now()',[state,provider]);
    if (!link || error || !code) return c.json({error:'Authorization expired or declined'},400);
    try {
        // Exchange authorization code for access token
        const tokenResponse = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: config.redirectUri
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            console.error('Token exchange failed', tokenResponse.status);
            return c.json({ error: 'Failed to exchange authorization code' }, 500);
        }

        const tokenData = await tokenResponse.json();

        const userId=link.user_id;
        let sub: string | undefined;
        if (provider==='linkedin' || provider==='google') {
            const identity=await fetch(provider==='google' ? 'https://openidconnect.googleapis.com/v1/userinfo' : 'https://api.linkedin.com/v2/userinfo',{headers:{Authorization:'Bearer '+tokenData.access_token}});
            if (!identity.ok) return c.json({error:'Provider identity unavailable'},403);
            sub=(await identity.json()).sub;
            if (!sub) return c.json({error:'Provider member identity unavailable'},403);
        }

        // --- Store Credentials ---
        await oauthManager.storeCredentials({
            userId,
            provider,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_in
                ? new Date(Date.now() + tokenData.expires_in * 1000)
                : undefined,
            scope: tokenData.scope,
            metadata: { sub, tokenType:tokenData.token_type }
        },state);

        return c.html(`
            <html>
                <body>
                    <h2>✅ Connected to ${provider}</h2>
                    <p>You can close this window now.</p>
                    <script>
                        window.opener.postMessage({ 
                            type: 'oauth_success', 
                            provider: '${provider}',

                            tokens: null
                        }, '*');
                        window.close();
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('OAuth callback error');
        return c.json({ error: 'Internal server error' }, 500);
    }
});

/**
 * Restricted routes below
 */
oauth.use('/status', authMiddleware);
oauth.use('/disconnect/*', authMiddleware);

/**
 * GET /oauth/status
 * Get list of connected providers for current user
 */
oauth.get('/status', async (c) => {
    const user = c.get('user');
    try {
        const providers = await oauthManager.getConnectedProviders(user.id);
        return c.json({ connectedProviders: providers });
    } catch (error) {
        console.error('Failed to get OAuth status');
        return c.json({ error: 'Failed to retrieve OAuth status' }, 500);
    }
});

/**
 * DELETE /oauth/disconnect/:provider
 * Disconnect OAuth provider
 */
oauth.delete('/disconnect/:provider', async (c) => {
    const user = c.get('user');
    const provider = c.req.param('provider');

    try {
        await oauthManager.deleteCredentials(user.id, provider);
        return c.json({ success: true });
    } catch (error) {
        console.error('Failed to disconnect provider');
        return c.json({ error: 'Failed to disconnect provider' }, 500);
    }
});

export { oauth };
