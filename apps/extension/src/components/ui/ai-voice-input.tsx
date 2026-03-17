"use client";

import { Mic } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { VoiceSessionStatus } from "../../hooks/useVoiceMode";

interface AIVoiceInputProps {
    status: VoiceSessionStatus;
    onStart?: () => void;
    onStop?: () => void;
    visualizerBars?: number;
    className?: string;
}

export function AIVoiceInput({
    status,
    onStart,
    onStop,
    visualizerBars = 48,
    className
}: AIVoiceInputProps) {
    const [time, setTime] = useState(0);
    const [isClient, setIsClient] = useState(false);

    const isActive = status !== 'disconnected' && status !== 'error';
    const isListening = status === 'listening';
    const isThinking = status === 'thinking';
    const isSpeaking = status === 'speaking';
    const isConnecting = status === 'connecting';

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Timer for active voice session
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;

        if (isActive) {
            intervalId = setInterval(() => {
                setTime((t) => t + 1);
            }, 1000);
        } else {
            setTime(0);
        }

        return () => clearInterval(intervalId);
    }, [isActive]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const handleClick = () => {
        if (isActive) {
            onStop?.();
        } else {
            onStart?.();
        }
    };

    // Get status text
    const getStatusText = () => {
        switch (status) {
            case 'connecting': return 'Connecting...';
            case 'listening': return 'Listening...';
            case 'thinking': return 'Thinking...';
            case 'speaking': return 'Speaking...';
            case 'error': return 'Error - Click to retry';
            default: return 'Click to speak';
        }
    };

    // Get button color based on status
    const getButtonColor = () => {
        switch (status) {
            case 'listening': return 'bg-red-500/20 border-red-500';
            case 'thinking': return 'bg-yellow-500/20 border-yellow-500';
            case 'speaking': return 'bg-green-500/20 border-green-500';
            case 'connecting': return 'bg-blue-500/20 border-blue-500';
            case 'error': return 'bg-destructive/20 border-destructive';
            default: return 'bg-transparent border-border hover:bg-muted';
        }
    };

    // Get visualizer color based on status
    const getVisualizerColor = () => {
        switch (status) {
            case 'listening': return 'bg-red-500';
            case 'thinking': return 'bg-yellow-500';
            case 'speaking': return 'bg-green-500';
            case 'connecting': return 'bg-blue-500';
            default: return 'bg-muted-foreground/30';
        }
    };

    return (
        <div className={cn("w-full py-4", className)}>
            <div className="relative max-w-xl w-full mx-auto flex items-center flex-col gap-2">
                {/* Main Button */}
                <button
                    className={cn(
                        "group w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300 border-2",
                        getButtonColor()
                    )}
                    type="button"
                    onClick={handleClick}
                >
                    {isActive ? (
                        <div
                            className={cn(
                                "w-6 h-6 rounded-sm cursor-pointer pointer-events-auto transition-colors",
                                isListening && "bg-red-500 animate-pulse",
                                isThinking && "bg-yellow-500 animate-spin",
                                isSpeaking && "bg-green-500 animate-pulse",
                                isConnecting && "bg-blue-500 animate-ping"
                            )}
                            style={isThinking ? { animationDuration: "2s" } : undefined}
                        />
                    ) : (
                        <Mic className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                </button>

                {/* Timer */}
                <span
                    className={cn(
                        "font-mono text-sm transition-opacity duration-300",
                        isActive
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                    )}
                >
                    {formatTime(time)}
                </span>

                {/* Visualizer */}
                <div className="h-8 w-64 flex items-center justify-center gap-0.5">
                    {[...Array(visualizerBars)].map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-0.5 rounded-full transition-all duration-150",
                                isActive ? getVisualizerColor() : "bg-muted-foreground/20 h-1"
                            )}
                            style={
                                isActive && isClient
                                    ? {
                                        height: `${Math.max(10, Math.sin(Date.now() / 100 + i * 0.5) * 40 + 50 + Math.random() * 30)}%`,
                                        animationDelay: `${i * 0.02}s`,
                                        opacity: isListening || isSpeaking ? 1 : 0.5,
                                    }
                                    : undefined
                            }
                        />
                    ))}
                </div>

                {/* Status Text */}
                <p className={cn(
                    "h-4 text-xs transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                    {getStatusText()}
                </p>
            </div>
        </div>
    );
}
