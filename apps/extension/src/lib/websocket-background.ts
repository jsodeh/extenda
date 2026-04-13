import { io, Socket } from 'socket.io-client';

/**
 * Dedicated WebSocket client for the background service worker.
 * Uses websocket-only transport (no HTTP polling) as required by Chrome extension service workers.
 */
class BackgroundWebSocketClient {
    private socket: Socket | null = null;
    private currentToken?: string;
    private listeners: Map<string, ((...args: any[]) => void)[]> = new Map();

    async connect(token: string) {
        // If already connected with same token, skip
        if (this.socket?.connected && this.currentToken === token) {
            console.log('[BgWS] Already connected');
            return;
        }

        // Disconnect existing if token changed
        if (this.socket && this.currentToken !== token) {
            this.socket.disconnect();
        }

        this.currentToken = token;

        // Read the user's preferred API URL from storage (set by Settings page)
        const defaultUrl = 'https://extenda-pxa6.onrender.com';
        let apiUrl = defaultUrl;
        try {
            const stored = await chrome.storage.local.get('extenda_backend_url');
            if (stored.extenda_backend_url) {
                apiUrl = stored.extenda_backend_url;
            }
        } catch (e) {
            console.warn('[BgWS] Could not read apiUrl from storage, using default');
        }

        console.log(`[BgWS] Connecting to API (websocket-only): ${apiUrl}...`);
        this.socket = io(apiUrl, {
            // CRITICAL: Use websocket only - polling fails in Chrome extension service workers
            transports: ['websocket'],
            upgrade: false,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 20000,
            auth: { token }
        });

        this.socket.on('connect', () => {
            console.log('[BgWS] Connected! Socket ID:', this.socket?.id);
            // Re-attach all stored listeners after successful connection
            this.replayListeners();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('[BgWS] Disconnected:', reason);
        });

        this.socket.on('connect_error', (err) => {
            console.error('[BgWS] Connection error:', err.message);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on(event: string, callback: (...args: any[]) => void) {
        // Store listener for replay on reconnect
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);

        // Attach immediately if socket exists
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    private replayListeners() {
        this.listeners.forEach((callbacks, event) => {
            callbacks.forEach(cb => {
                this.socket?.on(event, cb);
            });
        });
    }

    emit(event: string, data: any) {
        if (this.socket?.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn('[BgWS] Cannot emit - not connected');
        }
    }

    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }
}

export const bgWsClient = new BackgroundWebSocketClient();

