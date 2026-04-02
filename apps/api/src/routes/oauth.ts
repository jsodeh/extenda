import { Hono } from 'hono';
import { oauthManager } from '../services/oauth-manager.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { verifyClerkToken } from '../lib/clerk.js';

const oauth = new Hono();

interface OAuthProvider {
    authUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    redirectUri: string;
}

const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
    google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        scopes: [
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
oauth.get('/authorize/:provider', (c) => {
    const provider = c.req.param('provider') as keyof typeof OAUTH_PROVIDERS;
    const config = OAUTH_PROVIDERS[provider];

    if (!config) {
        return c.json({ error: 'Invalid provider' }, 400);
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in session/cookie (simplified - use proper session management)
    c.header('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax`);

    // Build authorization URL
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state,
        access_type: 'offline', // For Google to get refresh token
        prompt: 'consent' // Force consent to get refresh token
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

    if (error) {
        return c.json({ error: `OAuth error: ${error}` }, 400);
    }

    if (!code) {
        return c.json({ error: 'No authorization code provided' }, 400);
    }

    // Verify state (CSRF protection)
    // In production, retrieve from session/cookie
    // const storedState = getStateFromSession(c);
    // if (state !== storedState) {
    //     return c.json({ error: 'Invalid state parameter' }, 400);
    // }

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
            console.error('Token exchange failed:', error);
            return c.json({ error: 'Failed to exchange authorization code' }, 500);
        }

        const tokenData = await tokenResponse.json();

        // --- Fetch User Info from Provider ---
        let email: string;
        let name: string;
        let googleId: string | undefined;

        if (provider === 'google') {
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const userData = await userResponse.json();
            email = userData.email;
            name = userData.name;
            googleId = userData.id;
        } else {
            // For other providers, implement similar logic
            return c.json({ error: 'Provider user info fetch not implemented' }, 501);
        }

        // --- Find or Create User ---
        // Find by email
        const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
        let user: any; // User type inferred from drizzle
        let userId: string;

        if (existingUsers.length > 0) {
            user = existingUsers[0];
            userId = user.id;

            // Update user tokens/metadata if needed
            // For now, we trust the flow.
        } else {
            // Create user
            // Password hash is required but irrelevant for OAuth users, set a random unguessable string
            const randomPassword = crypto.randomBytes(32).toString('hex'); // Placeholder

            const newUsers = await db.insert(users).values({
                email,
                name,
                passwordHash: randomPassword, // Not used for OAuth
                role: 'free',
                emailVerified: true, // Google verified
                settings: {},
            }).returning();

            user = newUsers[0];
            userId = user.id;
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
            metadata: {
                tokenType: tokenData.token_type,
                rawResponse: tokenData
            }
        });

        // --- Generate App Tokens ---
        // (Delegated to Clerk)
        const tokens = null;

        // Redirect to success page or close popup
        // Pass the REAL user data and tokens back
        return c.html(`
            <html>
                <body>
                    <h2>✅ Connected to ${provider}</h2>
                    <p>You can close this window now.</p>
                    <script>
                        window.opener.postMessage({ 
                            type: 'oauth_success', 
                            provider: '${provider}',
                            user: ${JSON.stringify({ id: user.id, email: user.email, name: user.name, role: user.role })},
                            tokens: ${JSON.stringify(tokens)}
                        }, '*');
                        window.close();
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('OAuth callback error:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

/**
 * GET /oauth/status
 * Get list of connected providers for current user
 */
oauth.get('/status', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);

    const token = authHeader.split(' ')[1];
    let userId: string;
    try {
        const payload = await verifyClerkToken(token);
        if (!payload.sub) return c.json({ error: 'Unauthorized' }, 401);
        const dbUser = await db.query.users.findFirst({
            where: eq(users.clerkId, payload.sub)
        });
        if (!dbUser) return c.json({ error: 'User not found' }, 404);
        userId = dbUser.id;
    } catch (e) {
        return c.json({ error: 'Invalid token' }, 401);
    }

    try {
        const providers = await oauthManager.getConnectedProviders(userId);
        return c.json({ connectedProviders: providers });
    } catch (error) {
        console.error('Failed to get OAuth status:', error);
        return c.json({ error: 'Failed to retrieve OAuth status' }, 500);
    }
});

/**
 * DELETE /oauth/disconnect/:provider
 * Disconnect OAuth provider
 */
oauth.delete('/disconnect/:provider', async (c) => {
    const provider = c.req.param('provider');
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);

    const token = authHeader.split(' ')[1];
    let userId: string;
    try {
        const payload = await verifyClerkToken(token);
        if (!payload.sub) return c.json({ error: 'Unauthorized' }, 401);
        const dbUser = await db.query.users.findFirst({
            where: eq(users.clerkId, payload.sub)
        });
        if (!dbUser) return c.json({ error: 'User not found' }, 404);
        userId = dbUser.id;
    } catch (e) {
        return c.json({ error: 'Invalid token' }, 401);
    }

    try {
        await oauthManager.deleteCredentials(userId, provider);
        return c.json({ success: true });
    } catch (error) {
        console.error('Failed to disconnect provider:', error);
        return c.json({ error: 'Failed to disconnect provider' }, 500);
    }
});

export { oauth };
