import crypto from 'crypto';
import { pool } from '../db/index.js';

const query = (text: string, params?: any[]) => pool.query(text, params);

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

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
        this.encryptionKey = Buffer.from(ENCRYPTION_KEY || '', 'hex');
        if (ENCRYPTION_KEY && this.encryptionKey.length !== 32) {
            throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
        }
    }

    /**
     * Encrypt sensitive token data using AES-256-GCM
     */
    private encrypt(text: string): EncryptedData {
        if (this.encryptionKey.length!==32) throw new Error('Configure ENCRYPTION_KEY before connecting accounts');
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
                encrypted_refresh_token = COALESCE(EXCLUDED.encrypted_refresh_token, CASE
                    WHEN EXCLUDED.metadata->>'sub' IS NOT DISTINCT FROM oauth_credentials.metadata->>'sub'
                    THEN oauth_credentials.encrypted_refresh_token END),
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
        switch (provider) {
            case 'google':
                return await this.refreshGoogleToken(credentials);
            case 'linkedin':
                return this.refreshLinkedInToken(credentials);
            case 'slack':
                return await this.refreshSlackToken(credentials);
            default:
                throw new Error(`Token refresh not implemented for provider: ${provider}`);
        }
    }

    private async refreshLinkedInToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
        const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: process.env.LINKEDIN_CLIENT_ID || '',
                client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
                refresh_token: credentials.refreshToken!
            }),
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error('Reconnect LinkedIn to renew publishing permission');
        const data = await response.json();
        if (!data.access_token || !(data.expires_in > 0)) throw new Error('LinkedIn returned an incomplete token');
        const renewed = { ...credentials, accessToken: data.access_token,
            refreshToken: data.refresh_token || credentials.refreshToken, scope: data.scope || credentials.scope,
            expiresAt: new Date(Date.now() + data.expires_in * 1000) };
        await this.storeCredentials(renewed);
        return renewed;
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
                    client_secret: process.env.GOOGLE_AUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
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
        let credentials=await this.getCredentials(user.id,'google');
        if (!credentials) return user;
        if (this.isTokenExpired(credentials.expiresAt) && credentials.refreshToken) credentials=await this.refreshGoogleToken(credentials);
        return {...user,googleAccessToken:credentials.accessToken,googleRefreshToken:credentials.refreshToken};

    }
}

export const oauthManager = new OAuthManager();
