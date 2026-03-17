import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, X, FileText, Image as ImageIcon, Music, Video, File } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useVoiceMode } from '../../hooks/useVoiceMode';
import { VoiceOverlay } from '../voice/VoiceOverlay';

interface InputAreaProps {
    onSend: (message: string, files?: File[]) => void;
    disabled?: boolean;
    sessionId?: string | null;
    accessToken?: string | null;
    geminiApiKey?: string;
    onTranscript?: (text: string, role: 'user' | 'assistant') => void;
}

// File type to icon mapping
const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('audio/')) return Music;
    if (type.startsWith('video/')) return Video;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return FileText;
    return File;
};

// Get file extension from name
const getFileExtension = (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toUpperCase() : '';
};


export function InputArea({ onSend, disabled, sessionId, accessToken, geminiApiKey, onTranscript }: InputAreaProps) {
    const [input, setInput] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [filePreviews, setFilePreviews] = useState<Map<string, string>>(new Map());
    const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Voice mode hook - only enable if API key is provided
    const voice = useVoiceMode({
        sessionId: sessionId || null,
        accessToken: accessToken || null,
        apiKey: geminiApiKey || '',
        onTranscript: (text, role) => {
            if (role === 'user') {
                setInput(text);
                setVoiceTranscript(text);
            } else {
                setVoiceTranscript(text);
            }
            onTranscript?.(text, role);
        },
        onStatusChange: (status) => {
            console.log('[InputArea] Voice status:', status);
            // Close overlay when disconnected
            if (status === 'disconnected') {
                setShowVoiceOverlay(false);
                setVoiceTranscript('');
            }
        },
        onError: (error) => {
            console.error('[InputArea] Voice error:', error);
        }
    });

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!input.trim() && selectedFiles.length === 0) || disabled) return;

        onSend(input, selectedFiles.length > 0 ? selectedFiles : undefined);

        setInput('');
        setSelectedFiles([]);
        setFilePreviews(new Map());
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...newFiles]);

            // Generate previews for images
            newFiles.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        setFilePreviews(prev => new Map(prev).set(file.name + file.size, e.target?.result as string));
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        // Reset input to allow selecting same file again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (index: number) => {
        const file = selectedFiles[index];
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setFilePreviews(prev => {
            const newMap = new Map(prev);
            newMap.delete(file.name + file.size);
            return newMap;
        });
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [input]);

    return (
        <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border">
            <div className="max-w-3xl mx-auto">
                <div className={cn(
                    "relative flex flex-col rounded-xl border border-input bg-card shadow-sm transition-all",
                    "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
                    voice.isActive && "border-primary ring-1 ring-primary"
                )}>
                    {/* Voice Mode Active Indicator */}
                    {voice.isActive && (
                        <div className={cn(
                            "px-3 py-2 border-b border-border/50 flex items-center gap-2 text-sm",
                            voice.status === 'listening' && "text-red-500",
                            voice.status === 'thinking' && "text-yellow-500",
                            voice.status === 'speaking' && "text-green-500",
                            voice.status === 'connecting' && "text-blue-500"
                        )}>
                            <Mic size={14} className="animate-pulse" />
                            {voice.status === 'connecting' && "Connecting..."}
                            {voice.status === 'listening' && "Listening..."}
                            {voice.status === 'thinking' && "Thinking..."}
                            {voice.status === 'speaking' && "Speaking..."}
                        </div>
                    )}

                    {/* File Previews Row */}
                    {selectedFiles.length > 0 && (
                        <div className="px-3 pt-3 pb-1 border-b border-border/50">
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted">
                                {selectedFiles.map((file, index) => {
                                    const FileIcon = getFileIcon(file);
                                    const preview = filePreviews.get(file.name + file.size);
                                    const isImage = file.type.startsWith('image/');

                                    return (
                                        <div
                                            key={`${file.name}-${index}`}
                                            className="relative flex-shrink-0 group"
                                        >
                                            <div className="w-8 h-8 rounded-md border border-border bg-muted/50 overflow-hidden flex items-center justify-center">
                                                {isImage && preview ? (
                                                    <img
                                                        src={preview}
                                                        alt={file.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <FileIcon size={12} className="text-muted-foreground" />
                                                        <span className="text-[6px] font-medium text-muted-foreground uppercase">
                                                            {getFileExtension(file.name)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Remove button */}
                                            <button
                                                onClick={() => removeFile(index)}
                                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                title={file.name}
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Hidden file input - supports multiple files */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                        multiple
                        accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,audio/*,video/*"
                    />

                    {/* Text Area */}
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            voice.isActive
                                ? "Speak now or type..."
                                : selectedFiles.length > 0
                                    ? "Add a message about these files..."
                                    : "Ask Extenda to research, draft, or plan..."
                        }
                        disabled={disabled}
                        rows={1}
                        className="w-full bg-transparent px-4 pt-3 pb-2 text-sm placeholder:text-muted-foreground focus:outline-none resize-none min-h-[60px] max-h-[150px] overflow-y-auto"
                    />

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between px-2 pb-2">
                        {/* Left Actions */}
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "p-2 rounded-lg hover:bg-muted transition-colors",
                                    selectedFiles.length > 0 ? "text-primary" : "text-muted-foreground"
                                )}
                                title="Attach files"
                            >
                                <Paperclip size={18} />
                            </button>

                            {/* Voice Mode Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (!geminiApiKey) return;
                                    setShowVoiceOverlay(true);
                                    if (!voice.isActive) {
                                        voice.startVoiceMode();
                                    }
                                }}
                                disabled={!geminiApiKey}
                                className={cn(
                                    "p-2 rounded-lg transition-all duration-200",
                                    !geminiApiKey ? "opacity-50 cursor-not-allowed text-muted-foreground" :
                                        voice.isActive ? "bg-primary text-primary-foreground" :
                                            "text-muted-foreground hover:bg-muted"
                                )}
                                title={!geminiApiKey ? "Voice mode connecting..." : voice.isActive ? "Voice mode active" : "Start voice mode"}
                            >
                                <Mic size={18} />
                            </button>

                            {selectedFiles.length > 0 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                    {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        {/* Right Action: Send */}
                        <button
                            onClick={() => handleSubmit()}
                            disabled={((!input.trim() && selectedFiles.length === 0) || disabled)}
                            className={cn(
                                "p-2 rounded-lg transition-all duration-200",
                                (input.trim() || selectedFiles.length > 0)
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            )}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Voice Overlay */}
            <VoiceOverlay
                isOpen={showVoiceOverlay}
                status={voice.status}
                onStart={() => voice.startVoiceMode()}
                onStop={() => voice.stopVoiceMode()}
                onClose={() => {
                    voice.stopVoiceMode();
                    setShowVoiceOverlay(false);
                    setVoiceTranscript('');
                }}
                transcript={voiceTranscript}
            />
        </div>
    );
}
