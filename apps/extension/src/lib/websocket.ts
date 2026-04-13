import { io, Socket } from 'socket.io-client';

class WebSocketClient {
    private socket: Socket | null = null;
    private currentToken?: string;
    private listeners: Map<string, Function[]> = new Map();

    connect(token?: string, apiUrl?: string) {
        const targetUrl = apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:3000';

        // If already connected with the same token and url, don't reconnect
        if (this.socket && this.socket.connected && this.currentToken === token && (this.socket as any).io.uri === targetUrl) {
            return;
        }

        // If connected but token or url changed, disconnect first
        if (this.socket && (this.currentToken !== token || (this.socket as any).io.uri !== targetUrl)) {
            this.socket.disconnect();
        }

        this.currentToken = token;

        this.socket = io(targetUrl, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
            auth: {
                token
            }
        });

        this.socket.on('connect', () => {
            console.log('Connected to Extenda API via WebSocket');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from Extenda API');
        });

        // Replay listeners
        this.listeners.forEach((callbacks, event) => {
            callbacks.forEach(cb => this.socket?.on(event, cb as any));
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);

        if (this.socket) {
            this.socket.on(event, callback as any);
        }
    }

    emit(event: string, data?: any) {
        this.socket?.emit(event, data);
    }

    off(event: string, callback?: Function) {
        if (this.listeners.has(event)) {
            if (callback) {
                const cbs = this.listeners.get(event)?.filter(cb => cb !== callback) || [];
                this.listeners.set(event, cbs);
            } else {
                this.listeners.delete(event);
            }
        }

        if (this.socket) {
            if (callback) {
                this.socket.off(event, callback as any);
            } else {
                this.socket.off(event);
            }
        }
    }
}

export const wsClient = new WebSocketClient();
