/**
 * Audio Bridge for Gemini Live
 * Runs in offscreen document with full Web Audio API access
 * 
 * Handles:
 * - Microphone capture (16kHz PCM for Gemini)
 * - Audio playback (24kHz PCM from Gemini)
 * - Message passing to/from sidepanel
 */

let audioContext = null;
let mediaStream = null;
let processor = null;
let isCapturing = false;

// Playback
let playbackContext = null;
let audioQueue = [];
let isPlaying = false;

// ============================================================================
// AUDIO CAPTURE (Microphone → 16kHz PCM → base64)
// ============================================================================

async function startCapture() {
    if (isCapturing) {
        console.log('[AudioBridge] Already capturing');
        return { success: true };
    }

    try {
        // Request microphone
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        // Create audio context
        audioContext = new AudioContext({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(mediaStream);

        // Use ScriptProcessor for capturing audio chunks
        const bufferSize = 1600; // 100ms at 16kHz
        processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

        processor.onaudioprocess = (event) => {
            if (!isCapturing) return;

            const inputData = event.inputBuffer.getChannelData(0);

            // Convert Float32 to 16-bit PCM
            const pcm16 = float32ToPCM16(inputData);

            // Convert to base64
            const base64 = arrayBufferToBase64(pcm16.buffer);

            // Send to background/sidepanel
            chrome.runtime.sendMessage({
                type: 'AUDIO_CHUNK',
                data: base64
            });
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        isCapturing = true;
        console.log('[AudioBridge] Capture started');

        return { success: true };

    } catch (error) {
        console.error('[AudioBridge] Capture failed:', error);
        return { success: false, error: error.message };
    }
}

function stopCapture() {
    isCapturing = false;

    if (processor) {
        processor.disconnect();
        processor = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    console.log('[AudioBridge] Capture stopped');
    return { success: true };
}

// ============================================================================
// AUDIO PLAYBACK (base64 PCM 24kHz → Speaker)
// ============================================================================

async function initPlayback() {
    if (!playbackContext) {
        playbackContext = new AudioContext({ sampleRate: 24000 });
    }
    return { success: true };
}

function queueAudio(base64Data) {
    try {
        // Decode base64 to PCM
        const binaryString = atob(base64Data);
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
        const audioBuffer = playbackContext.createBuffer(1, float32.length, 24000);
        audioBuffer.copyToChannel(float32, 0);

        audioQueue.push(audioBuffer);

        if (!isPlaying) {
            playNext();
        }

        return { success: true };
    } catch (error) {
        console.error('[AudioBridge] Queue audio failed:', error);
        return { success: false, error: error.message };
    }
}

function playNext() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        chrome.runtime.sendMessage({ type: 'PLAYBACK_COMPLETE' });
        return;
    }

    isPlaying = true;
    const buffer = audioQueue.shift();

    const source = playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(playbackContext.destination);

    source.onended = () => {
        playNext();
    };

    source.start();
}

function stopPlayback() {
    audioQueue = [];
    isPlaying = false;
    return { success: true };
}

// ============================================================================
// UTILITIES
// ============================================================================

function float32ToPCM16(float32Array) {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[AudioBridge] Message:', message.type);

    switch (message.type) {
        case 'START_CAPTURE':
            startCapture().then(sendResponse);
            return true;

        case 'STOP_CAPTURE':
            sendResponse(stopCapture());
            break;

        case 'INIT_PLAYBACK':
            initPlayback().then(sendResponse);
            return true;

        case 'QUEUE_AUDIO':
            sendResponse(queueAudio(message.data));
            break;

        case 'STOP_PLAYBACK':
            sendResponse(stopPlayback());
            break;

        case 'PING':
            sendResponse({ success: true, ready: true });
            break;
    }

    return false;
});

console.log('[AudioBridge] Ready');
