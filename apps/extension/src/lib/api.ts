import { envService } from './environment-service';

/**
 * Dynamically resolves the Backend API URL from the environment service.
 */
export const getApiUrl = async (): Promise<string> => {
    return envService.getUrl();
};

export async function privateRequest(path: string, options: RequestInit = {}) {
    const { accessToken } = await chrome.storage.local.get('accessToken');
    if (!accessToken) throw new Error('Sign in to continue');
    const response = await fetch((await getApiUrl()) + path, {
        ...options, headers: { ...options.headers, Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || detail.metadata?.error || 'Request failed');
    }
    return response;
}
