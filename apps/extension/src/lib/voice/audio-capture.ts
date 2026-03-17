/**
 * Audio Capture - Microphone input for voice mode
 * Captures audio at 16KHz 16-bit PCM format for Gemini Live API
 */

export interface AudioCaptureConfig {
    onAudioData: (audioBase64: string) => void;
    chunkSizeMs?: number;  // Size of each audio chunk in ms (default: 100ms)
    onError?: (error: Error) => void;
}

export class AudioCapture {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private config: AudioCaptureConfig;
    private isCapturing = false;

    constructor(config: AudioCaptureConfig) {
        this.config = config;
    }

    /**
     * Start capturing audio from microphone
     */
    async start(): Promise<void> {
        if (this.isCapturing) {
            console.warn('[AudioCapture] Already capturing');
            return;
        }

        try {
            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // Create audio context at 16KHz
            this.audioContext = new AudioContext({ sampleRate: 16000 });

            // Create source from microphone
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Use ScriptProcessor for compatibility (AudioWorklet requires hosted context)
            const bufferSize = Math.floor(16000 * (this.config.chunkSizeMs || 100) / 1000);
            const processor = this.audioContext.createScriptProcessor(
                this.closestPowerOf2(bufferSize),
                1,  // Input channels
                1   // Output channels
            );

            processor.onaudioprocess = (event) => {
                if (!this.isCapturing) return;

                const inputData = event.inputBuffer.getChannelData(0);

                // Convert Float32 to 16-bit PCM
                const pcmData = this.float32ToPCM16(inputData);

                // Convert to base64 - create proper ArrayBuffer copy
                const bufferCopy = pcmData.buffer.slice(0) as ArrayBuffer;
                const base64 = this.arrayBufferToBase64(bufferCopy);

                // Send to callback
                this.config.onAudioData(base64);
            };

            // Connect the chain
            source.connect(processor);
            processor.connect(this.audioContext.destination);

            this.isCapturing = true;
            console.log('[AudioCapture] Started capturing at 16KHz');

        } catch (error: any) {
            console.error('[AudioCapture] Failed to start:', error);
            this.config.onError?.(error);
            throw error;
        }
    }

    /**
     * Stop capturing audio
     */
    stop(): void {
        this.isCapturing = false;

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        console.log('[AudioCapture] Stopped');
    }

    /**
     * Check if currently capturing
     */
    isActive(): boolean {
        return this.isCapturing;
    }

    /**
     * Convert Float32Array to Int16Array (PCM 16-bit)
     */
    private float32ToPCM16(float32Array: Float32Array): Int16Array {
        const pcm16 = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            // Clamp to [-1, 1] and convert to 16-bit
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return pcm16;
    }

    /**
     * Convert ArrayBuffer to base64 string
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Find closest power of 2 for buffer size
     */
    private closestPowerOf2(n: number): number {
        const powers = [256, 512, 1024, 2048, 4096, 8192, 16384];
        for (const p of powers) {
            if (p >= n) return p;
        }
        return 16384;
    }
}
