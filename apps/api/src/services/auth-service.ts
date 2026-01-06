import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export class AuthService {
    /**
     * Register a new user
     */
    static async register(email: string, password: string, name: string): Promise<User> {
        // Check if user exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            throw new Error('User already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, name, password_hash, role, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING id, email, name, role`,
            [email, name, passwordHash, 'free']
        );

        return result.rows[0];
    }

    /**
     * Login user
     */
    static async login(email: string, password: string, ipAddress?: string, userAgent?: string): Promise<{ user: User; tokens: TokenPair }> {
        // Find user
        const result = await pool.query(
            'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            throw new Error('Invalid credentials');
        }

        const user = result.rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        // Update last login
        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Generate tokens
        const tokens = await this.generateTokens(user.id, ipAddress, userAgent);

        // Remove password hash from response
        delete user.password_hash;

        return { user, tokens };
    }

    /**
     * Generate JWT access and refresh tokens
     */
    static async generateTokens(userId: string, ipAddress?: string, userAgent?: string): Promise<TokenPair> {
        const secret = this.getJwtSecret();
        const accessToken = jwt.sign({ userId }, secret, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jwt.sign({ userId, type: 'refresh' }, secret, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });

        // Store refresh token
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await pool.query(
            `INSERT INTO sessions (user_id, refresh_token, expires_at, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, refreshToken, expiresAt, ipAddress, userAgent]
        );

        return { accessToken, refreshToken };
    }

    /**
     * Refresh access token
     */
    static async refreshToken(refreshToken: string): Promise<TokenPair> {
        // Verify refresh token
        let decoded: any;
        try {
            decoded = jwt.verify(refreshToken, this.getJwtSecret());
        } catch (error) {
            throw new Error('Invalid refresh token');
        }

        // Check if token exists in database
        const result = await pool.query(
            'SELECT user_id, expires_at FROM sessions WHERE refresh_token = $1',
            [refreshToken]
        );

        if (result.rows.length === 0) {
            throw new Error('Refresh token not found');
        }

        const session = result.rows[0];

        // Check if expired
        if (new Date(session.expires_at) < new Date()) {
            throw new Error('Refresh token expired');
        }

        // Delete old refresh token
        await pool.query('DELETE FROM sessions WHERE refresh_token = $1', [refreshToken]);

        // Generate new tokens
        return this.generateTokens(session.user_id);
    }

    /**
     * Verify JWT token
     */
    static verifyToken(token: string): { userId: string } {
        const secret = this.getJwtSecret();
        try {
            // console.log('Verifying token:', token.substring(0, 20) + '...', 'Secret Len:', secret.length);
            const decoded = jwt.verify(token, secret) as any;
            return { userId: decoded.userId };
        } catch (error) {
            console.error('Token verification failed:', (error as Error).message);
            throw new Error('Invalid token');
        }
    }

    private static getJwtSecret(): string {
        return process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    }

    /**
     * Logout user
     */
    static async logout(refreshToken: string): Promise<void> {
        await pool.query('DELETE FROM sessions WHERE refresh_token = $1', [refreshToken]);
    }

    /**
     * Get user by ID
     */
    static async getUserById(userId: string): Promise<User | null> {
        const result = await pool.query(
            'SELECT id, email, name, role FROM users WHERE id = $1',
            [userId]
        );

        return result.rows[0] || null;
    }

    /**
     * Delete all sessions for user
     */
    static async deleteAllSessions(userId: string): Promise<void> {
        await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    }
}
