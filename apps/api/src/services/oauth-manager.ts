import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { pool } from '../db/index.js';

const query = (text: string, params?: any[]) => pool.query(text, params);

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

interface OAuthCredentials {
    binding?: string;
    encryptedVersion?: string;
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
        if (this.encryptionKey.length !== 32)
            throw new Error('Configure ENCRYPTION_KEY before connecting accounts');
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

    private async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private seal(value: string) {
        return JSON.stringify(this.encrypt(value));
    }

    async storeCredentials(credentials: OAuthCredentials, linkState?: string): Promise<void> {
        if (!credentials.accessToken) throw new Error('Provider returned an incomplete grant');
        const { userId, provider, accessToken, refreshToken, expiresAt, scope } = credentials;
        const metadata = { ...credentials.metadata, grant: crypto.randomUUID() };
        await this.transaction(async (client) => {
            await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
            if (linkState) {
                const claim = await client.query(
                    'DELETE FROM oauth_link_states WHERE nonce=$1 AND user_id=$2 AND provider=$3 AND expires_at>now()',
                    [linkState, userId, provider]
                );
                if (!claim.rowCount) throw new Error('Connection expired. Reconnect the account.');
            }
            await client.query(
                `
                INSERT INTO oauth_credentials(user_id,provider,encrypted_access_token,encrypted_refresh_token,expires_at,scope,metadata)
                VALUES($1,$2,$3,$4,$5,$6,$7)
                ON CONFLICT(user_id,provider) DO UPDATE SET
                    encrypted_access_token=excluded.encrypted_access_token,
                    encrypted_refresh_token=COALESCE(excluded.encrypted_refresh_token, CASE
                        WHEN excluded.metadata->>'sub'=oauth_credentials.metadata->>'sub'
                        THEN oauth_credentials.encrypted_refresh_token END),
                    metadata=CASE WHEN excluded.metadata->>'sub'=oauth_credentials.metadata->>'sub'
                        THEN excluded.metadata || jsonb_build_object('grant',coalesce(oauth_credentials.metadata->>'grant',oauth_credentials.id::text))
                        ELSE excluded.metadata END,
                    scope=excluded.scope, expires_at=excluded.expires_at, updated_at=now()`,
                [
                    userId,
                    provider,
                    this.seal(accessToken),
                    refreshToken ? this.seal(refreshToken) : null,
                    expiresAt,
                    scope,
                    metadata
                ]
            );
            if (provider === 'google') await this.clearLegacy(client, userId);
        });
    }

    private clearLegacy(client: PoolClient, owner: string) {
        return client.query('UPDATE users SET google_access_token=NULL, google_refresh_token=NULL WHERE id=$1', [
            owner
        ]);
    }

    private async migrateLegacyGoogle(owner: string) {
        await this.transaction(async (client) => {
            const {
                rows: [legacy]
            } = await client.query(
                `SELECT google_access_token,google_refresh_token FROM users
                WHERE id=$1 AND (google_access_token IS NOT NULL OR google_refresh_token IS NOT NULL) FOR UPDATE`,
                [owner]
            );
            if (!legacy) return;
            if (legacy.google_access_token || legacy.google_refresh_token) {
                await client.query(
                    `INSERT INTO oauth_credentials(user_id,provider,encrypted_access_token,encrypted_refresh_token,expires_at,metadata)
                    VALUES($1,'google',$2,$3,$4,'{"requiresReconnect":true}') ON CONFLICT(user_id,provider) DO NOTHING`,
                    [
                        owner,
                        this.seal(legacy.google_access_token || ''),
                        legacy.google_refresh_token ? this.seal(legacy.google_refresh_token) : null,
                        legacy.google_refresh_token ? new Date(0) : null
                    ]
                );
            }
            await this.clearLegacy(client, owner);
        });
    }

    async getCredentials(userId: string, provider: string): Promise<OAuthCredentials | null> {
        if (provider === 'google') await this.migrateLegacyGoogle(userId);
        const {
            rows: [row]
        } = await query('SELECT * FROM oauth_credentials WHERE user_id=$1 AND provider=$2', [userId, provider]);
        if (!row || row.metadata?.requiresReconnect === true) return null;
        return this.decode(row);
    }

    private decode(row: any): OAuthCredentials {
        const accessData: EncryptedData = JSON.parse(row.encrypted_access_token);
        const refreshData: EncryptedData | null = row.encrypted_refresh_token
            ? JSON.parse(row.encrypted_refresh_token)
            : null;

        return {
            binding: row.metadata?.grant || String(row.id),
            encryptedVersion: row.encrypted_access_token,
            userId: row.user_id,
            provider: row.provider,
            accessToken: this.decrypt(accessData),
            refreshToken: refreshData ? this.decrypt(refreshData) : undefined,
            expiresAt: row.expires_at,
            scope: row.scope,
            metadata: row.metadata
        };
    }

    async current(userId: string, provider: string, expectedBinding?: string) {
        const credentials = await this.getCredentials(userId, provider);
        if (!credentials) throw new Error('Reconnect ' + provider + ' and review the action again');
        if (expectedBinding !== undefined && credentials.binding !== expectedBinding)
            throw new Error('Provider account changed. Review it again.');
        if (!this.isTokenExpired(credentials.expiresAt)) return credentials;
        const refreshed = await this.refresh(credentials);
        if (!refreshed || refreshed.binding !== credentials.binding)
            throw new Error('Account changed. Review the action again.');
        return refreshed;
    }

    // Disconnect and reconnect wait for an already-dispatched provider call. A new call
    // can start only while its exact reviewed grant is still the active database row.
    async withGrant<T>(
        owner: string,
        provider: string,
        binding: unknown,
        call: (credentials: OAuthCredentials) => Promise<T>
    ) {
        if (typeof binding !== 'string' || !binding)
            throw new Error('Review the current provider account before delivery');
        await this.current(owner, provider, binding);
        return this.transaction(async (client) => {
            const {
                rows: [row]
            } = await client.query(
                `SELECT * FROM oauth_credentials WHERE user_id=$1 AND provider=$2
                AND metadata->>'requiresReconnect' IS DISTINCT FROM 'true'
                AND coalesce(metadata->>'grant',id::text)=$3 FOR SHARE`,
                [owner, provider, binding]
            );
            if (!row) throw new Error('Provider account changed. Reconnect and review the action again.');
            return call(this.decode(row));
        });
    }

    private async finishRefresh(old: OAuthCredentials, data: any) {
        if (!data.access_token || !(data.expires_in > 0)) throw new Error('Provider returned an incomplete token');
        const {
            rows: [row]
        } = await query(
            `UPDATE oauth_credentials SET encrypted_access_token=$4,
            encrypted_refresh_token=coalesce($5,encrypted_refresh_token),expires_at=$6,scope=coalesce($7,scope),updated_at=now()
            WHERE user_id=$1 AND provider=$2 AND encrypted_access_token=$3 RETURNING *`,
            [
                old.userId,
                old.provider,
                old.encryptedVersion,
                this.seal(data.access_token),
                data.refresh_token ? this.seal(data.refresh_token) : null,
                new Date(Date.now() + data.expires_in * 1000),
                data.scope
            ]
        );
        if (row) return this.decode(row);
        const current = await this.getCredentials(old.userId, old.provider);
        if (current && current.binding === old.binding && !this.isTokenExpired(current.expiresAt)) return current;
        throw new Error('Connection changed during refresh. Reconnect and review the action again.');
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
        return this.refresh(credentials);
    }

    private async refresh(credentials: OAuthCredentials | null) {
        if (!credentials || !credentials.refreshToken) {
            throw new Error('No refresh token available');
        }

        // Provider-specific refresh logic
        switch (credentials.provider) {
            case 'google':
                return await this.refreshGoogleToken(credentials);
            case 'linkedin':
                return this.refreshLinkedInToken(credentials);
            case 'slack':
                return await this.refreshSlackToken(credentials);
            default:
                throw new Error(`Token refresh not implemented for provider: ${credentials.provider}`);
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
        return this.finishRefresh(credentials, data);
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
            return this.finishRefresh(credentials, data);
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
        await this.transaction(async (client) => {
            await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
            await client.query('DELETE FROM oauth_link_states WHERE user_id=$1 AND provider=$2', [
                userId,
                provider
            ]);
            await client.query('DELETE FROM oauth_credentials WHERE user_id=$1 AND provider=$2', [
                userId,
                provider
            ]);
            if (provider === 'google') await this.clearLegacy(client, userId);
        });
    }

    async getConnectedProviders(userId: string): Promise<string[]> {
        await this.migrateLegacyGoogle(userId);
        const { rows } = await query(
            "SELECT provider FROM oauth_credentials WHERE user_id=$1 AND metadata->>'requiresReconnect' IS DISTINCT FROM 'true'",
            [userId]
        );
        return rows.map((row) => row.provider);
    }
}

export const oauthManager = new OAuthManager();
