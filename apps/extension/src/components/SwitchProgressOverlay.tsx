import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Database, Globe, ArrowRight } from 'lucide-react';
import { Environment } from '../lib/environment-service';

interface SwitchProgressOverlayProps {
    target: Environment;
    isSwitching: boolean;
    error?: string;
    onRetry?: () => void;
    onCancel?: () => void;
}

export default function SwitchProgressOverlay({ 
    target, 
    isSwitching, 
    error, 
    onRetry, 
    onCancel 
}: SwitchProgressOverlayProps) {
    if (!isSwitching && !error) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300 text-center">
                
                {/* Status Icon */}
                <div className="flex justify-center">
                    <div className={`p-5 rounded-full ${error ? 'bg-destructive/10' : 'bg-primary/10'} relative`}>
                        {error ? (
                            <AlertCircle className="w-10 h-10 text-destructive" />
                        ) : (
                            <>
                                <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-foreground">
                        {error ? 'Switch Failed' : `Switching to ${target.toUpperCase()}`}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {error || 'Moving your workspace settings and history to the new environment. One moment...'}
                    </p>
                </div>

                {/* Progress Steps (Visual only for now) */}
                {!error && (
                    <div className="space-y-3 py-4 text-left">
                        <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <span className="opacity-70 line-through">Probing target...</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                            <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                            <span>Synchronizing history...</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                            <div className="w-4 h-4 rounded-full border-2 border-muted" />
                            <span>Updating preference...</span>
                        </div>
                    </div>
                )}

                {/* Details Card */}
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5" />
                        <span className="font-mono opacity-60">Source</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-primary" />
                        <span className="font-bold text-primary capitalize">{target}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    {error ? (
                        <>
                            <button
                                onClick={onRetry}
                                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={onCancel}
                                className="w-full py-3 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-all border border-border/50"
                            >
                                Revert Change
                            </button>
                        </>
                    ) : (
                        <div className="py-2">
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary animate-[shimmer_2s_infinite] w-full origin-left" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
