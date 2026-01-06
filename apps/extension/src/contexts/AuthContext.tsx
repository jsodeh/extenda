import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
    id: number;
    email: string;
    name: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    loginWithOAuth: (provider: 'google' | 'github' | 'linkedin') => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = 'https://extenda-api-604583941288.us-central1.run.app';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load tokens from localStorage on mount
    useEffect(() => {
        const storedAccessToken = localStorage.getItem('accessToken');
        const storedRefreshToken = localStorage.getItem('refreshToken');

        if (storedAccessToken && storedRefreshToken) {
            setAccessToken(storedAccessToken);
            setRefreshToken(storedRefreshToken);
            // Sync to chrome storage for background worker
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ accessToken: storedAccessToken });
            }
            fetchUser(storedAccessToken);
        } else {
            setIsLoading(false);
        }
    }, []);

    // Fetch current user
    const fetchUser = async (token: string) => {
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                if (response.status === 401) {
                    await logout();
                    return;
                }
                // Token invalid, try to refresh
                await refreshAccessToken();
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Refresh access token
    const refreshAccessToken = async () => {
        if (!refreshToken) return;

        try {
            const response = await fetch(`${API_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                setAccessToken(data.tokens.accessToken);
                setRefreshToken(data.tokens.refreshToken);
                localStorage.setItem('accessToken', data.tokens.accessToken);
                localStorage.setItem('refreshToken', data.tokens.refreshToken);
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    chrome.storage.local.set({ accessToken: data.tokens.accessToken });
                }
                await fetchUser(data.tokens.accessToken);
            } else {
                // Refresh failed, logout
                handleLogout();
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            handleLogout();
        }
    };

    const login = async (email: string, password: string) => {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        setUser(data.user);
        setAccessToken(data.tokens.accessToken);
        setRefreshToken(data.tokens.refreshToken);
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ accessToken: data.tokens.accessToken });
        }
    };

    const register = async (email: string, password: string, name: string) => {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }

        const data = await response.json();
        setUser(data.user);
        setAccessToken(data.tokens.accessToken);
        setRefreshToken(data.tokens.refreshToken);
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ accessToken: data.tokens.accessToken });
        }
    };

    const loginWithOAuth = async (provider: 'google' | 'github' | 'linkedin') => {
        return new Promise<void>((resolve, reject) => {
            // Open OAuth popup window
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            const popup = window.open(
                `${API_URL}/oauth/auth/${provider}`,
                `oauth_${provider}`,
                `width=${width},height=${height},left=${left},top=${top}`
            );

            if (!popup) {
                reject(new Error('Failed to open OAuth popup. Please allow popups for this site.'));
                return;
            }

            // Listen for OAuth callback
            const handleMessage = async (event: MessageEvent) => {
                // Verify origin for security
                if (event.origin !== API_URL) return;

                if (event.data.type === 'oauth_success' && event.data.provider === provider) {
                    window.removeEventListener('message', handleMessage);

                    try {
                        // Extract tokens from the callback
                        const { user: userData, tokens } = event.data;

                        if (!tokens || !userData) {
                            reject(new Error('Invalid OAuth response'));
                            return;
                        }

                        // Store tokens and user data
                        setUser(userData);
                        setAccessToken(tokens.accessToken);
                        setRefreshToken(tokens.refreshToken);
                        localStorage.setItem('accessToken', tokens.accessToken);
                        localStorage.setItem('refreshToken', tokens.refreshToken);
                        if (typeof chrome !== 'undefined' && chrome.storage) {
                            chrome.storage.local.set({ accessToken: tokens.accessToken });
                        }

                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                } else if (event.data.type === 'oauth_error') {
                    window.removeEventListener('message', handleMessage);
                    reject(new Error(event.data.error || 'OAuth authentication failed'));
                }
            };

            window.addEventListener('message', handleMessage);

            // Set a timeout in case the popup is closed without OAuth completion
            // We can't reliably check popup.closed due to COOP policies, so use timeout instead
            const timeout = setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                reject(new Error('OAuth authentication timed out after 5 minutes'));
            }, 300000); // 5 minutes

            // Clean up timeout on success/error
            const originalResolve = resolve;
            const originalReject = reject;

            resolve = (() => {
                clearTimeout(timeout);
                originalResolve();
            }) as any;

            reject = ((err: any) => {
                clearTimeout(timeout);
                originalReject(err);
            }) as any;
        });
    };

    const handleLogout = () => {
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.remove('accessToken');
        }
    };

    const logout = async () => {
        if (refreshToken) {
            try {
                await fetch(`${API_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
        handleLogout();
    };

    return (
        <AuthContext.Provider value={{ user, accessToken, login, register, loginWithOAuth, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
