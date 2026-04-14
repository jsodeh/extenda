import crypto from 'crypto';
import { pool } from '../db/index.js';

const query = (text: string, params?: any[]) => pool.query(text, params);

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

interface OAuthCredentials {
    id?: number;
    userId: string;
    provider: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
    metadata?: Record<string, any>;
}

interface EncryptedData {
    encrypted: string;
    iv: string;
    authTag: string;
}

export class OAuthManager {
    private encryptionKey: Buffer;

    constructor() {
        this.encryptionKey = Buffer.from(ENCRYPTION_KEY, 'hex');
        if (this.encryptionKey.length !== 32) {
            throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
        }
    }

    /**
     * Encrypt sensitive token data using AES-256-GCM
     */
    private encrypt(text: string): EncryptedData {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt token data
     */
    private decrypt(data: EncryptedData): string {
        const decipher = crypto.createDecipheriv(
            ENCRYPTION_ALGORITHM,
            this.encryptionKey,
            Buffer.from(data.iv, 'hex')
        );

        decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

        let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Store OAuth credentials (encrypted)
     */
    async storeCredentials(credentials: OAuthCredentials): Promise<void> {
        const encryptedAccess = this.encrypt(credentials.accessToken);
        const encryptedRefresh = credentials.refreshToken
            ? this.encrypt(credentials.refreshToken)
            : null;

        const accessTokenData = JSON.stringify(encryptedAccess);
        const refreshTokenData = encryptedRefresh ? JSON.stringify(encryptedRefresh) : null;

        await query(`
            INSERT INTO oauth_credentials 
            (user_id, provider, encrypted_access_token, encrypted_refresh_token, expires_at, scope, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, provider) 
            DO UPDATE SET
                encrypted_access_token = EXCLUDED.encrypted_access_token,
                encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
                expires_at = EXCLUDED.expires_at,
                scope = EXCLUDED.scope,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        `, [
            credentials.userId,
            credentials.provider,
            accessTokenData,
            refreshTokenData,
            credentials.expiresAt,
            credentials.scope,
            JSON.stringify(credentials.metadata || {})
        ]);
    }

    /**
     * Retrieve OAuth credentials (decrypted)
     */
    async getCredentials(userId: string, provider: string): Promise<OAuthCredentials | null> {
        const result = await query(`
            SELECT * FROM oauth_credentials 
            WHERE user_id = $1 AND provider = $2
        `, [userId, provider]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        const accessData: EncryptedData = JSON.parse(row.encrypted_access_token);
        const refreshData: EncryptedData | null = row.encrypted_refresh_token
            ? JSON.parse(row.encrypted_refresh_token)
            : null;

        return {
            id: row.id,
            userId: row.user_id,
            provider: row.provider,
            accessToken: this.decrypt(accessData),
            refreshToken: refreshData ? this.decrypt(refreshData) : undefined,
            expiresAt: row.expires_at,
            scope: row.scope,
            metadata: row.metadata
        };
    }

    /**
     * Check if token is expired or expiring soon (within 5 minutes)
     */
    isTokenExpired(expiresAt?: Date): boolean {
        if (!expiresAt) return false;
        const now = new Date();
        const expiryTime = new Date(expiresAt);
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        return expiryTime <= fiveMinutesFromNow;
    }

    /**
     * Refresh OAuth token (provider-specific logic needed)
     */
    async refreshToken(userId: string, provider: string): Promise<OAuthCredentials | null> {
        const credentials = await this.getCredentials(userId, provider);
        if (!credentials || !credentials.refreshToken) {
            throw new Error('No refresh token available');
        }

        // Provider-specific refresh logic
        // This is a placeholder - actual implementation depends on provider
        switch (provider) {
            case 'google':
                return await this.refreshGoogleToken(credentials);
            case 'slack':
                return await this.refreshSlackToken(credentials);
            default:
                throw new Error(`Token refresh not implemented for provider: ${provider}`);
        }
    }

    private async refreshGoogleToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID || '',
                    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
                    refresh_token: credentials.refreshToken!,
                    grant_type: 'refresh_token'
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error('Failed to refresh Google token');
            }


            const data = await response.json();
            const newCredentials: OAuthCredentials = {
                userId: credentials.userId,
                provider: 'google',
                accessToken: data.access_token,
                refreshToken: data.refresh_token || credentials.refreshToken,
                expiresAt: new Date(Date.now() + data.expires_in * 1000),
                scope: credentials.scope,
                metadata: credentials.metadata
            };

            await this.storeCredentials(newCredentials);
            return newCredentials;
        } catch (error) {
            clearTimeout(timeout); // Clear timeout if an error occurs
            throw error;
        }
    }

    private async refreshSlackToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
        // Slack doesn't support token refresh in the same way
        // Tokens are long-lived or require re-authorization
        throw new Error('Slack tokens do not expire - re-authorization required');
    }

    /**
     * Delete OAuth credentials
     */
    async deleteCredentials(userId: string, provider: string): Promise<void> {
        await query(`
            DELETE FROM oauth_credentials 
            WHERE user_id = $1 AND provider = $2
        `, [userId, provider]);
    }

    async getConnectedProviders(userId: string): Promise<string[]> {
        const result = await query(`
            SELECT provider FROM oauth_credentials 
            WHERE user_id = $1
        `, [userId]);

        const providers = result.rows.map((row: any) => row.provider);

        // Check if user has googleAccessToken in users table (from signup)
        const userResult = await query(`
            SELECT google_access_token FROM users WHERE id = $1
        `, [userId]);

        if (userResult.rows.length > 0 && userResult.rows[0].google_access_token) {
            if (!providers.includes('google')) {
                providers.push('google');
            }
        }

        return providers;
    }

    /**
     * Ensure user has valid tokens, refreshing if necessary
     */
    async ensureValidToken(user: any): Promise<any> { // Typing as any for User to avoid circular deps
        if (!user.googleAccessToken) return user;

        // Check expiry (conservatively assuming 1 hour if not tracked)
        // Ideally DB should track expiry. For now, we'll try to refresh if we have a refresh token
        // and let the refresh logic handle validity.
        // Optimization: Use separate table for detailed token info or expand User schema

        if (user.googleRefreshToken) {
            try {
                // We reconstruct a partial credentials object
                const credentials: OAuthCredentials = {
                    userId: user.id,
                    provider: 'google',
                    accessToken: user.googleAccessToken,
                    refreshToken: user.googleRefreshToken,
                    // expiresAt: user.googleTokenExpiresAt // TODO: Add this to schema
                };

                // For now, ALWAYS try to refresh if we have a refresh token to be safe
                // or just rely on the error handler?
                // Better: Just return the user. The adapter layer can also handle 401s, 
                // but we want proactive. 
                // Let's rely on a check. Since we don't hold expiry in User table yet,
                // we will attempt a refresh if the token effectively "looks" old or on every request?
                // On every request is too slow.

                // Let's check the oauth_credentials table which DOES have expiry
                const storedCreds = await this.getCredentials(user.id, 'google');

                if (storedCreds && this.isTokenExpired(storedCreds.expiresAt)) {
                    console.log('Token expired for user', user.id, 'refreshing...');
                    const newCreds = await this.refreshGoogleToken(storedCreds);

                    // Update the user object in memory (and DB is updated by refreshGoogleToken)
                    // We also need to sync the user table columns
                    await query(`
                        UPDATE users 
                        SET google_access_token = $1, google_refresh_token = $2
                        WHERE id = $3
                    `, [newCreds.accessToken, newCreds.refreshToken, user.id]);

                    return {
                        ...user,
                        googleAccessToken: newCreds.accessToken,
                        googleRefreshToken: newCreds.refreshToken
                    };
                }
            } catch (error) {
                console.warn('Failed to refresh token proactively:', error);
                // Return original user, let it fail downstream if invalid
            }
        }

        return user;
    }
}

export const oauthManager = new OAuthManager();
