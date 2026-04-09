/**
 * OAuth Popup Handler for Browser Extension
 * Opens OAuth popup, listens for success message, closes popup
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface OAuthResult {
    success: boolean;
    provider?: string;
    error?: string;
}

export async function initiateOAuthFlow(provider: string): Promise<OAuthResult> {
    return new Promise((resolve) => {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
            `${API_BASE_URL}/oauth/authorize/${provider}`,
            `oauth_${provider}`,
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
            resolve({ success: false, error: 'Popup blocked' });
            return;
        }

        // Listen for OAuth success message from popup
        const messageHandler = (event: MessageEvent) => {
            if (event.origin !== API_BASE_URL) return;

            if (event.data.type === 'oauth_success') {
                window.removeEventListener('message', messageHandler);
                resolve({ success: true, provider: event.data.provider });
            }
        };

        window.addEventListener('message', messageHandler);

        // Check if popup was closed without completing OAuth
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', messageHandler);
                resolve({ success: false, error: 'OAuth flow cancelled' });
            }
        }, 500);
    });
}

export async function fetchConnectedProviders(): Promise<string[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/oauth/status`);
        if (!response.ok) throw new Error('Failed to fetch providers');
        const data = await response.json();
        return data.connectedProviders || [];
    } catch (error) {
        console.error('Failed to fetch connected providers:', error);
        return [];
    }
}

export async function disconnectProvider(provider: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/oauth/disconnect/${provider}`, {
            method: 'DELETE'
        });
        return response.ok;
    } catch (error) {
        console.error(`Failed to disconnect ${provider}:`, error);
        return false;
    }
}
