/**
 * Voice Mode Hook - Gemini Live Integration
 * 
 * Connects:
 * - Sidepanel UI (voice button, status)
 * - Audio Bridge (offscreen document for mic/speaker)
 * - Gemini Live (WebSocket for real-time AI)
 * - Unified Tool Router (for executing tools)
 * - Session persistence (via WebSocket events)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceSessionManager, VoiceSessionStatus } from '../lib/voice/session-manager';
import { wsClient } from '../lib/websocket';

interface UseVoiceModeOptions {
    sessionId: string | null;
    accessToken: string | null;
    apiKey: string;  // Gemini API key
    onTranscript?: (text: string, role: 'user' | 'assistant') => void;
    onStatusChange?: (status: VoiceSessionStatus) => void;
    onError?: (error: Error) => void;
}

interface UseVoiceModeReturn {
    status: VoiceSessionStatus;
    isActive: boolean;
    startVoiceMode: () => Promise<void>;
    stopVoiceMode: () => void;
    sendText: (text: string) => void;  // For hybrid mode
}

// Offscreen document state
let offscreenReady = false;
let offscreenCreating: Promise<void> | null = null;

/**
 * Ensure offscreen document exists for audio
 */
async function ensureOffscreenDocument(): Promise<void> {
    if (offscreenReady) return;
    if (offscreenCreating) {
        await offscreenCreating;
        return;
    }

    const chromeAny = chrome as any;

    // Check if offscreen API available
    if (!chromeAny.offscreen) {
        throw new Error('Offscreen API not available. Update Chrome.');
    }

    try {
        // Check if already exists
        if (chromeAny.runtime.getContexts) {
            const contexts = await chromeAny.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT']
            });
            if (contexts.length > 0) {
                offscreenReady = true;
                return;
            }
        }
    } catch (e) {
        // Ignore - getContexts may not exist
    }

    // Create offscreen document
    try {
        offscreenCreating = chromeAny.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
            justification: 'Voice mode requires microphone and speaker access'
        });
        await offscreenCreating;
        offscreenReady = true;
    } catch (e: any) {
        if (e.message?.includes('already exists')) {
            offscreenReady = true;
        } else {
            throw e;
        }
    } finally {
        offscreenCreating = null;
    }
}

export function useVoiceMode(options: UseVoiceModeOptions): UseVoiceModeReturn {
    const [status, setStatus] = useState<VoiceSessionStatus>('disconnected');
    const sessionRef = useRef<VoiceSessionManager | null>(null);
    const messageListenerRef = useRef<((message: any) => void) | null>(null);

    // Status change handler
    const handleStatusChange = useCallback((newStatus: VoiceSessionStatus) => {
        setStatus(newStatus);
        options.onStatusChange?.(newStatus);
    }, [options]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopVoiceMode();
        };
    }, []);

    /**
     * Start voice mode
     */
    const startVoiceMode = useCallback(async () => {
        try {
            // 1. Ensure offscreen document exists
            await ensureOffscreenDocument();

            // 2. Create Gemini Live session
            sessionRef.current = new VoiceSessionManager({
                apiKey: options.apiKey,
                context: {
                    accessToken: options.accessToken || undefined,
                    sessionId: options.sessionId || undefined,
                    apiUrl: import.meta.env.VITE_API_URL || 'https://extenda-pxa6.onrender.com'
                },
                onStatusChange: handleStatusChange,
                onTranscript: (text, role) => {
                    options.onTranscript?.(text, role);

                    // Persist to session via WebSocket
                    if (options.sessionId) {
                        wsClient.emit('voice:transcript', {
                            sessionId: options.sessionId,
                            text,
                            role
                        });
                    }
                },
                onAudioData: (audioData) => {
                    // Send to offscreen for playback
                    const base64 = arrayBufferToBase64(audioData);
                    chrome.runtime.sendMessage({ type: 'QUEUE_AUDIO', data: base64 });
                },
                onToolCall: (name, args) => {
                    console.log('[VoiceMode] Tool call:', name, args);
                    // Notify server about tool execution
                    if (options.sessionId) {
                        wsClient.emit('voice:tool_call', {
                            sessionId: options.sessionId,
                            tool: name,
                            params: args
                        });
                    }
                },
                onToolResult: (name, result) => {
                    console.log('[VoiceMode] Tool result:', name, result);
                },
                onError: options.onError
            });

            // 3. Connect to Gemini Live
            await sessionRef.current.connect();

            // 4. Set up audio chunk listener
            messageListenerRef.current = (message: any) => {
                if (message.type === 'AUDIO_CHUNK' && sessionRef.current) {
                    sessionRef.current.sendAudio(message.data);
                }
                if (message.type === 'PLAYBACK_COMPLETE') {
                    // Playback finished, ready for more input
                    handleStatusChange('listening');
                }
            };
            chrome.runtime.onMessage.addListener(messageListenerRef.current);

            // 5. Initialize playback and start capture
            await chrome.runtime.sendMessage({ type: 'INIT_PLAYBACK' });
            await chrome.runtime.sendMessage({ type: 'START_CAPTURE' });

            console.log('[VoiceMode] Started successfully');

        } catch (error: any) {
            console.error('[VoiceMode] Failed to start:', error);
            handleStatusChange('error');
            options.onError?.(error);
        }
    }, [options, handleStatusChange]);

    /**
     * Stop voice mode
     */
    const stopVoiceMode = useCallback(() => {
        // Stop audio capture
        chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
        chrome.runtime.sendMessage({ type: 'STOP_PLAYBACK' });

        // Remove message listener
        if (messageListenerRef.current) {
            chrome.runtime.onMessage.removeListener(messageListenerRef.current);
            messageListenerRef.current = null;
        }

        // Disconnect Gemini Live
        if (sessionRef.current) {
            sessionRef.current.disconnect();
            sessionRef.current = null;
        }

        handleStatusChange('disconnected');
        console.log('[VoiceMode] Stopped');
    }, [handleStatusChange]);

    /**
     * Send text in hybrid mode
     */
    const sendText = useCallback((text: string) => {
        if (sessionRef.current?.isConnected()) {
            sessionRef.current.sendText(text);
        } else {
            console.warn('[VoiceMode] Not connected, cannot send text');
        }
    }, []);

    return {
        status,
        isActive: status !== 'disconnected' && status !== 'error',
        startVoiceMode,
        stopVoiceMode,
        sendText
    };
}

// Utility
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Re-export status type
export type { VoiceSessionStatus };
