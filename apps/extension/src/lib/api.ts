/**
 * Dynamically resolves the Backend API URL from chrome storage.
 * Fallbacks to environment variable or localhost.
 */
export const getApiUrl = async (): Promise<string> => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['extenda_backend_url'], (result) => {
                resolve(result.extenda_backend_url || import.meta.env.VITE_API_URL || 'http://localhost:3000');
            });
        });
    }
    return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};
