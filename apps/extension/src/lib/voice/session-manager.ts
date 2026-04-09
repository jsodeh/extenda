/**
 * Gemini Live Voice Session Manager
 * Real-time bidirectional audio streaming with function calling
 * Connected to unified tool router for full tool access
 */

import { TOOL_DECLARATIONS, executeTool, ToolExecutionContext } from '../tools/tool-router';

export type VoiceSessionStatus =
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'listening'
    | 'thinking'
    | 'speaking'
    | 'error';

export interface VoiceSessionConfig {
    apiKey: string;
    model?: string;
    systemInstruction?: string;
    context?: ToolExecutionContext;
    onAudioData?: (audioData: ArrayBuffer) => void;
    onTranscript?: (text: string, role: 'user' | 'assistant') => void;
    onStatusChange?: (status: VoiceSessionStatus) => void;
    onError?: (error: Error) => void;
    onToolCall?: (name: string, args: any) => void;
    onToolResult?: (name: string, result: any) => void;
}

const DEFAULT_MODEL = 'models/gemini-2.0-flash';

/**
 * Voice Session Manager for Gemini Live API
 * Handles WebSocket connection, audio streaming, and function calling integrated with tools
 */
export class VoiceSessionManager {
    private ws: WebSocket | null = null;
    private config: VoiceSessionConfig;
    private status: VoiceSessionStatus = 'disconnected';
    private sessionId: string | null = null;

    constructor(config: VoiceSessionConfig) {
        this.config = config;
    }

    /**
     * Connect to Gemini Live API
     */
    async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('[VoiceSession] Already connected');
            return;
        }

        this.setStatus('connecting');

        const model = this.config.model || DEFAULT_MODEL;
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.config.apiKey}`;

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('[VoiceSession] WebSocket connected');
                    this.sendSetupMessage();
                    this.setStatus('connected');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    console.error('[VoiceSession] WebSocket error:', error);
                    this.setStatus('error');
                    this.config.onError?.(new Error('WebSocket connection failed'));
                    reject(error);
                };

                this.ws.onclose = (event) => {
                    console.log('[VoiceSession] WebSocket closed:', event.code, event.reason);
                    this.setStatus('disconnected');
                };
            } catch (error) {
                this.setStatus('error');
                reject(error);
            }
        });
    }

    /**
     * Send initial setup message with configuration and tools
     */
    private sendSetupMessage(): void {
        const setupMessage = {
            setup: {
                model: `models/${this.config.model || DEFAULT_MODEL}`,
                generation_config: {
                    response_modalities: ['AUDIO', 'TEXT'],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: 'Aoede'
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{
                        text: this.config.systemInstruction || this.getDefaultSystemInstruction()
                    }]
                },
                tools: this.getToolDefinitions()
            }
        };

        this.ws?.send(JSON.stringify(setupMessage));
        console.log('[VoiceSession] Setup message sent with', TOOL_DECLARATIONS.length, 'tools');
    }

    /**
     * Get default system instruction
     */
    private getDefaultSystemInstruction(): string {
        return `You are Extenda, an AI-powered browser assistant. You help users automate tasks through voice commands.

CAPABILITIES:
- Open, close, and switch browser tabs
- Click on elements by describing them (using AI vision)
- Read page content
- Fill forms
- Send and read emails (Gmail)
- Manage calendar events (Google Calendar)
- Search files (Google Drive)
- Show notifications

BEHAVIOR:
- Be concise and conversational
- Confirm actions briefly before executing
- Report results clearly
- If something fails, explain why and suggest alternatives
- Use tools proactively when the user's intent is clear

When using tools, execute immediately - don't ask for confirmation unless the action is destructive or ambiguous.`;
    }

    /**
     * Get tool definitions in Gemini format
     */
    private getToolDefinitions(): any[] {
        return [{
            function_declarations: TOOL_DECLARATIONS.map(tool => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }))
        }];
    }

    /**
     * Handle incoming WebSocket messages
     */
    private async handleMessage(data: string): Promise<void> {
        try {
            const message = JSON.parse(data);

            // Handle setup complete
            if (message.setupComplete) {
                console.log('[VoiceSession] Setup complete');
                this.setStatus('listening');
                return;
            }

            // Handle server content (audio/text response)
            if (message.serverContent) {
                await this.handleServerContent(message.serverContent);
            }

            // Handle tool calls
            if (message.toolCall) {
                await this.handleToolCall(message.toolCall);
            }

        } catch (error) {
            console.error('[VoiceSession] Error parsing message:', error);
        }
    }

    /**
     * Handle server content (audio and text responses)
     */
    private async handleServerContent(content: any): Promise<void> {
        // Check for interruption
        if (content.interrupted) {
            console.log('[VoiceSession] Interrupted');
            return;
        }

        // Handle model turn with audio/text
        if (content.modelTurn?.parts) {
            this.setStatus('speaking');

            for (const part of content.modelTurn.parts) {
                if (part.inlineData?.data) {
                    // Audio data (base64 encoded)
                    const audioBytes = this.base64ToArrayBuffer(part.inlineData.data);
                    this.config.onAudioData?.(audioBytes);
                }
                if (part.text) {
                    this.config.onTranscript?.(part.text, 'assistant');
                }
            }
        }

        // Turn complete
        if (content.turnComplete) {
            console.log('[VoiceSession] Turn complete');
            this.setStatus('listening');
        }
    }

    /**
     * Handle tool/function calls from Gemini
     */
    private async handleToolCall(toolCall: any): Promise<void> {
        console.log('[VoiceSession] Tool call received:', toolCall);
        this.setStatus('thinking');

        const functionCalls = toolCall.functionCalls || [];
        const responses: any[] = [];

        for (const fc of functionCalls) {
            const { name, args, id } = fc;

            this.config.onToolCall?.(name, args);

            try {
                // Execute tool via unified router
                const result = await executeTool(name, args || {}, this.config.context || {});

                console.log('[VoiceSession] Tool result:', name, result);
                this.config.onToolResult?.(name, result);

                responses.push({
                    id,
                    name,
                    response: { result: JSON.stringify(result) }
                });
            } catch (error: any) {
                console.error('[VoiceSession] Tool error:', name, error);

                responses.push({
                    id,
                    name,
                    response: { error: error.message }
                });
            }
        }

        // Send tool responses back to Gemini
        this.ws?.send(JSON.stringify({
            toolResponse: {
                functionResponses: responses
            }
        }));
    }

    /**
     * Send audio data to Gemini (base64 PCM 16kHz)
     */
    sendAudio(audioBase64: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[VoiceSession] WebSocket not connected');
            return;
        }

        if (this.status !== 'listening' && this.status !== 'connected') {
            this.setStatus('listening');
        }

        const message = {
            realtimeInput: {
                mediaChunks: [{
                    mimeType: 'audio/pcm;rate=16000',
                    data: audioBase64
                }]
            }
        };

        this.ws.send(JSON.stringify(message));
    }

    /**
     * Send text input (for hybrid mode)
     */
    sendText(text: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[VoiceSession] WebSocket not connected');
            return;
        }

        this.setStatus('thinking');
        this.config.onTranscript?.(text, 'user');

        const message = {
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [{ text }]
                }],
                turnComplete: true
            }
        };

        this.ws.send(JSON.stringify(message));
    }

    /**
     * Disconnect from Gemini Live API
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.setStatus('disconnected');
    }

    /**
     * Get current status
     */
    getStatus(): VoiceSessionStatus {
        return this.status;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Update and emit status
     */
    private setStatus(status: VoiceSessionStatus): void {
        if (this.status !== status) {
            this.status = status;
            this.config.onStatusChange?.(status);
        }
    }

    /**
     * Convert base64 to ArrayBuffer
     */
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}
