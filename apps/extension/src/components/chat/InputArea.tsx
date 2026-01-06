import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Mic, Globe, Paperclip } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../ThemeProvider';

interface InputAreaProps {
    onSend: (message: string, file?: File) => void;
    disabled?: boolean;
}

export function InputArea({ onSend, disabled }: InputAreaProps) {
    const [input, setInput] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { theme } = useTheme();

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!input.trim() && !selectedFile) || disabled) return;

        onSend(input, selectedFile || undefined);

        setInput('');
        setSelectedFile(null);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
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
                    "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
                )}>
                    {/* File Preview */}
                    {selectedFile && (
                        <div className="mx-2 mt-2 p-2 bg-muted/50 rounded flex items-center justify-between animate-in fade-in slide-in-from-bottom-1">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Paperclip size={14} className="text-muted-foreground shrink-0" />
                                <span className="text-xs truncate max-w-[200px]">{selectedFile.name}</span>
                                <span className="text-[10px] text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="text-muted-foreground hover:text-destructive transition-colors ml-2"
                            >
                                <Plus size={14} className="rotate-45" />
                            </button>
                        </div>
                    )}

                    {/* Top: Text Area */}
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedFile ? "Add a message..." : "Ask Extenda to research, draft, or plan..."}
                        disabled={disabled}
                        rows={1}
                        className="w-full bg-transparent px-4 pt-3 pb-2 text-sm placeholder:text-muted-foreground focus:outline-none resize-none min-h-[60px] max-h-[150px] overflow-y-auto"
                    />

                    {/* Hidden input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    {/* Bottom: Actions */}
                    <div className="flex items-center justify-between px-2 pb-2">
                        {/* Left Actions */}
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "p-2 rounded-lg hover:bg-muted transition-colors",
                                    selectedFile ? "text-primary" : "text-muted-foreground"
                                )}
                                title="Upload File"
                            >
                                <Paperclip size={18} />
                            </button>
                            <button
                                type="button"
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                                title="Voice Input"
                            >
                                <Mic size={18} />
                            </button>
                            <button
                                type="button"
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors hidden sm:flex items-center gap-1"
                                title="Search Mode"
                            >
                                <Globe size={16} />
                                <span className="text-xs font-medium">Web</span>
                            </button>
                        </div>

                        {/* Right Action: Send */}
                        <button
                            onClick={() => handleSubmit()}
                            disabled={(!input.trim() && !selectedFile) || disabled}
                            className={cn(
                                "p-2 rounded-lg transition-all duration-200",
                                (input.trim() || selectedFile)
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            )}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
