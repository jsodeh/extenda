import { Hono } from 'hono';
import { AuthService } from '../services/auth-service.js';

const auth = new Hono();

/**
 * POST /api/auth/register
 * Register a new user
 */
auth.post('/register', async (c) => {
    try {
        const { email, password, name } = await c.req.json();

        if (!email || !password || !name) {
            return c.json({ error: 'Email, password, and name are required' }, 400);
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return c.json({ error: 'Invalid email format' }, 400);
        }

        // Validate password strength
        if (password.length < 8) {
            return c.json({ error: 'Password must be at least 8 characters' }, 400);
        }

        const user = await AuthService.register(email, password, name);
        const tokens = await AuthService.generateTokens(user.id);

        return c.json({ user, tokens });
    } catch (error: any) {
        console.error('Registration error:', error);
        if (error.message === 'User already exists') {
            return c.json({ error: error.message }, 409);
        }
        return c.json({ error: 'Registration failed' }, 500);
    }
});

/**
 * POST /api/auth/login
 * Login user
 */
auth.post('/login', async (c) => {
    try {
        const { email, password } = await c.req.json();

        if (!email || !password) {
            return c.json({ error: 'Email and password are required' }, 400);
        }

        const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
        const userAgent = c.req.header('user-agent');

        const { user, tokens } = await AuthService.login(email, password, ipAddress, userAgent);

        return c.json({ user, tokens });
    } catch (error: any) {
        console.error('Login error:', error);
        if (error.message === 'Invalid credentials') {
            return c.json({ error: error.message }, 401);
        }
        return c.json({ error: 'Login failed' }, 500);
    }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
auth.post('/refresh', async (c) => {
    try {
        const { refreshToken } = await c.req.json();

        if (!refreshToken) {
            return c.json({ error: 'Refresh token is required' }, 400);
        }

        const tokens = await AuthService.refreshToken(refreshToken);

        return c.json({ tokens });
    } catch (error: any) {
        console.error('Refresh token error:', error);
        return c.json({ error: 'Invalid refresh token' }, 401);
    }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
auth.post('/logout', async (c) => {
    try {
        const { refreshToken } = await c.req.json();

        if (refreshToken) {
            await AuthService.logout(refreshToken);
        }

        return c.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return c.json({ error: 'Logout failed' }, 500);
    }
});

/**
 * GET /api/auth/me
 * Get current user
 */
auth.get('/me', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const token = authHeader.substring(7);
        const { userId } = AuthService.verifyToken(token);
        const user = await AuthService.getUserById(userId);

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        return c.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        return c.json({ error: 'Unauthorized' }, 401);
    }
});

export default auth;
