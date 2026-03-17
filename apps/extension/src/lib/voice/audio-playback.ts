/**
 * Audio Playback - Speaker output for voice mode
 * Plays audio at 24KHz 16-bit PCM format from Gemini Live API
 */

export interface AudioPlaybackConfig {
    onPlaybackStart?: () => void;
    onPlaybackEnd?: () => void;
    onError?: (error: Error) => void;
}

export class AudioPlayback {
    private audioContext: AudioContext | null = null;
    private config: AudioPlaybackConfig;
    private audioQueue: AudioBuffer[] = [];
    private isPlaying = false;
    private currentSource: AudioBufferSourceNode | null = null;

    constructor(config: AudioPlaybackConfig = {}) {
        this.config = config;
    }

    /**
     * Initialize audio context (must be called after user interaction)
     */
    async initialize(): Promise<void> {
        if (this.audioContext) return;

        // Create audio context at 24KHz for Gemini output
        this.audioContext = new AudioContext({ sampleRate: 24000 });
        console.log('[AudioPlayback] Initialized at 24KHz');
    }

    /**
     * Queue audio chunk for playback
     */
    async queueAudio(audioBase64: string): Promise<void> {
        if (!this.audioContext) {
            await this.initialize();
        }

        try {
            // Decode base64 to ArrayBuffer
            const binaryString = atob(audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Convert PCM 16-bit to Float32
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
            }

            // Create AudioBuffer
            const audioBuffer = this.audioContext!.createBuffer(
                1,  // Mono
                float32.length,
                24000  // 24KHz
            );
            audioBuffer.copyToChannel(float32, 0);

            // Queue for playback
            this.audioQueue.push(audioBuffer);

            // Start playback if not already playing
            if (!this.isPlaying) {
                this.playNext();
            }

        } catch (error: any) {
            console.error('[AudioPlayback] Error queuing audio:', error);
            this.config.onError?.(error);
        }
    }

    /**
     * Play next buffer in queue
     */
    private playNext(): void {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            this.config.onPlaybackEnd?.();
            return;
        }

        if (!this.audioContext) return;

        this.isPlaying = true;
        if (this.audioQueue.length === this.audioQueue.length) {  // First in series
            this.config.onPlaybackStart?.();
        }

        const buffer = this.audioQueue.shift()!;
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);

        source.onended = () => {
            this.playNext();
        };

        this.currentSource = source;
        source.start();
    }

    /**
     * Stop current playback and clear queue
     */
    stop(): void {
        this.audioQueue = [];

        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // May already be stopped
            }
            this.currentSource = null;
        }

        this.isPlaying = false;
        console.log('[AudioPlayback] Stopped');
    }

    /**
     * Check if currently playing
     */
    isActive(): boolean {
        return this.isPlaying;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
