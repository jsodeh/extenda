import { Hono } from 'hono';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { sign } from 'hono/jwt';

const authOAuth = new Hono();

interface OAuthConfig {
    authUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    redirectUri: string;
}

// OAuth providers for USER AUTHENTICATION (different from service integration OAuth)
// Using a function to ensure env vars are loaded before accessing them
function getOAuthProviders(): Record<string, OAuthConfig> {
    return {
        google: {
            authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
            clientId: process.env.GOOGLE_AUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
            scopes: [
                'openid',
                'email',
                'profile',
                // Gmail
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.send',
                // Calendar
                'https://www.googleapis.com/auth/calendar.readonly',
                'https://www.googleapis.com/auth/calendar.events',
                // Drive
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/drive.file',
                // Sheets
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/spreadsheets',
                // Docs
                'https://www.googleapis.com/auth/documents.readonly',
                'https://www.googleapis.com/auth/documents',
                // Forms
                'https://www.googleapis.com/auth/forms.body',
                'https://www.googleapis.com/auth/forms.responses.readonly',
                // Slides
                'https://www.googleapis.com/auth/presentations.readonly',
                'https://www.googleapis.com/auth/presentations',
                // Contacts (People API)
                'https://www.googleapis.com/auth/contacts.readonly',
                'https://www.googleapis.com/auth/contacts'
            ],
            redirectUri: process.env.GOOGLE_AUTH_REDIRECT_URI || 'http://localhost:3000/oauth/auth/callback/google'
        },
        github: {
            authUrl: 'https://github.com/login/oauth/authorize',
            tokenUrl: 'https://github.com/login/oauth/access_token',
            userInfoUrl: 'https://api.github.com/user',
            clientId: process.env.GITHUB_CLIENT_ID || '',
            clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
            scopes: ['user:email'],
            redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/oauth/auth/callback/github'
        },
        linkedin: {
            authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
            tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
            userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
            clientId: process.env.LINKEDIN_CLIENT_ID || '',
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
            scopes: ['openid', 'profile', 'email', 'w_member_social', 'r_liteprofile'],
            redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/oauth/auth/callback/linkedin'
        }
    };
}

// Debug: Log OAuth configuration at startup (after first call)
let debugLogged = false;
function logDebugOnce() {
    if (!debugLogged) {
        const providers = getOAuthProviders();
        console.log('OAuth Auth Providers Configuration:');
        console.log('Google client_id:', providers.google.clientId || '(empty)');
        console.log('Google client_secret:', providers.google.clientSecret ? '(set)' : '(empty)');
        console.log('Google redirect_uri:', providers.google.redirectUri);
        debugLogged = true;
    }
}


/**
 * GET /oauth/auth/:provider
 * Initiate OAuth flow for user authentication
 */
authOAuth.get('/:provider', (c) => {
    logDebugOnce();
    const OAUTH_AUTH_PROVIDERS = getOAuthProviders();
    const provider = c.req.param('provider') as keyof typeof OAUTH_AUTH_PROVIDERS;
    const config = OAUTH_AUTH_PROVIDERS[provider];

    if (!config) {
        return c.json({ error: 'Invalid OAuth provider' }, 400);
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in cookie (simplified - in production use session)
    c.header('Set-Cookie', `oauth_auth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);

    // Build authorization URL
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state
    });

    // Add provider-specific parameters
    if (provider === 'google') {
        params.append('access_type', 'offline');
        params.append('prompt', 'consent');
    }

    return c.redirect(`${config.authUrl}?${params.toString()}`);
});

/**
 * GET /oauth/auth/callback/:provider
 * Handle OAuth callback and create/login user
 */
authOAuth.get('/callback/:provider', async (c) => {
    const OAUTH_AUTH_PROVIDERS = getOAuthProviders();
    const provider = c.req.param('provider') as keyof typeof OAUTH_AUTH_PROVIDERS;
    const config = OAUTH_AUTH_PROVIDERS[provider];

    if (!config) {
        return c.json({ error: 'Invalid OAuth provider' }, 400);
    }

    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
        return sendErrorResponse(c, provider, `OAuth error: ${error}`);
    }

    if (!code) {
        return sendErrorResponse(c, provider, 'No authorization code provided');
    }

    try {
        // Exchange authorization code for access token
        const tokenResponse = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
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
            return sendErrorResponse(c, provider, 'Failed to exchange authorization code');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Fetch user info from provider
        const userInfoResponse = await fetch(config.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!userInfoResponse.ok) {
            return sendErrorResponse(c, provider, 'Failed to fetch user information');
        }

        const userInfo = await userInfoResponse.json();

        // Extract email and name based on provider
        let email: string;
        let name: string;

        if (provider === 'google') {
            email = userInfo.email;
            name = userInfo.name || userInfo.email.split('@')[0];
        } else if (provider === 'github') {
            // GitHub might not provide email in userinfo, need to fetch separately
            email = userInfo.email;

            // If email is not public, fetch from emails endpoint
            if (!email) {
                const emailsResponse = await fetch('https://api.github.com/user/emails', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                });

                if (emailsResponse.ok) {
                    const emails = await emailsResponse.json();
                    const primaryEmail = emails.find((e: any) => e.primary);
                    email = primaryEmail?.email || emails[0]?.email;
                }
            }

            name = userInfo.name || userInfo.login;
        } else if (provider === 'linkedin') {
            email = userInfo.email;
            name = userInfo.name || userInfo.localizedFirstName + ' ' + userInfo.localizedLastName;
        } else {
            return sendErrorResponse(c, provider, 'Unsupported provider');
        }

        if (!email) {
            return sendErrorResponse(c, provider, 'Could not retrieve email from OAuth provider');
        }

        // Find or create user
        let user = await db.query.users.findFirst({
            where: eq(users.email, email)
        });

        if (!user) {
            // Create new user
            const [newUser] = await db.insert(users).values({
                email,
                name,
                role: 'free',
                settings: {},
                googleAccessToken: provider === 'google' ? tokenData.access_token : null,
                googleRefreshToken: provider === 'google' ? tokenData.refresh_token : null,
            }).returning();
            user = newUser;
        } else {
            // Update existing user with new tokens
            if (provider === 'google') {
                const updates: any = {
                    googleAccessToken: tokenData.access_token
                };
                if (tokenData.refresh_token) {
                    updates.googleRefreshToken = tokenData.refresh_token;
                }

                const [updatedUser] = await db.update(users)
                    .set(updates)
                    .where(eq(users.id, user.id))
                    .returning();
                user = updatedUser;
            }
        }

        // Generate JWT tokens
        const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';

        const jwtAccessToken = await sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
            },
            jwtSecret
        );

        const jwtRefreshToken = await sign(
            {
                userId: user.id,
                type: 'refresh',
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // 30 days
            },
            jwtSecret
        );

        // Send success response with tokens via postMessage
        return c.html(`
            <html>
                <head>
                    <title>Sign in successful</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        }
                        .container {
                            background: white;
                            padding: 2rem;
                            border-radius: 1rem;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                            text-align: center;
                        }
                        h2 { color: #333; margin-bottom: 0.5rem; }
                        p { color: #666; }
                        .success { font-size: 3rem; margin-bottom: 1rem; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success">✅</div>
                        <h2>Sign in successful!</h2>
                        <p>You can close this window now.</p>
                    </div>
                    <script>
                        window.opener.postMessage({
                            type: 'oauth_success',
                            provider: '${provider}',
                            user: ${JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        })},
                            tokens: {
                                accessToken: '${jwtAccessToken}',
                                refreshToken: '${jwtRefreshToken}'
                            }
                        }, '*');
                        setTimeout(() => window.close(), 2000);
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('OAuth authentication error:', error);
        return sendErrorResponse(c, provider, 'Internal server error during authentication');
    }
});

function sendErrorResponse(c: any, provider: string, errorMessage: string) {
    return c.html(`
        <html>
            <head>
                <title>Sign in failed</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    }
                    .container {
                        background: white;
                        padding: 2rem;
                        border-radius: 1rem;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                    }
                    h2 { color: #d32f2f; margin-bottom: 0.5rem; }
                    p { color: #666; }
                    .error { font-size: 3rem; margin-bottom: 1rem; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error">❌</div>
                    <h2>Sign in failed</h2>
                    <p>${errorMessage}</p>
                </div>
                <script>
                    window.opener.postMessage({
                        type: 'oauth_error',
                        provider: '${provider}',
                        error: '${errorMessage}'
                    }, '*');
                    setTimeout(() => window.close(), 3000);
                </script>
            </body>
        </html>
    `);
}

export { authOAuth };
