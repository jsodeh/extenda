/**
 * Voice Overlay - Full screen modal for voice interaction
 * Shows during active voice mode with animated visualizer
 */

import { X } from "lucide-react";
import { AIVoiceInput } from "../ui/ai-voice-input";
import { VoiceSessionStatus } from "../../hooks/useVoiceMode";
import { cn } from "../../lib/utils";

interface VoiceOverlayProps {
    isOpen: boolean;
    status: VoiceSessionStatus;
    onStart: () => void;
    onStop: () => void;
    onClose: () => void;
    transcript?: string;
}

export function VoiceOverlay({
    isOpen,
    status,
    onStart,
    onStop,
    onClose,
    transcript
}: VoiceOverlayProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/95 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Content */}
            <div className="relative z-10 w-full max-w-md px-4">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-4 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                    <X size={20} />
                </button>

                {/* Voice Input with Animation */}
                <AIVoiceInput
                    status={status}
                    onStart={onStart}
                    onStop={onStop}
                    visualizerBars={32}
                />

                {/* Transcript display */}
                {transcript && (
                    <div className="mt-6 p-4 rounded-lg bg-muted/50 max-h-40 overflow-y-auto">
                        <p className="text-sm text-muted-foreground">
                            "{transcript}"
                        </p>
                    </div>
                )}

                {/* Instructions */}
                <div className="mt-8 text-center text-xs text-muted-foreground space-y-1">
                    <p>Try saying:</p>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                        <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">"Open Gmail"</span>
                        <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">"What's on my calendar?"</span>
                        <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">"Send an email"</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
