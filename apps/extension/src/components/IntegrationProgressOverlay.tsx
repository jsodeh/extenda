import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Link2, Unlink, RotateCcw } from 'lucide-react';

export type IntegrationAction = 'connect' | 'disconnect' | 'reset' | null;

interface IntegrationProgressOverlayProps {
    action: IntegrationAction;
    providerName?: string;
    icon?: string;
    error?: string;
    onRetry?: () => void;
    onCancel?: () => void;
}

export default function IntegrationProgressOverlay({
    action,
    providerName,
    icon,
    error,
    onRetry,
    onCancel
}: IntegrationProgressOverlayProps) {
    if (!action && !error) return null;

    const isReset = action === 'reset';
    const isConnect = action === 'connect';

    const getTitle = () => {
        if (error) return 'Action Failed';
        if (isReset) return 'Resetting Defaults';
        return isConnect ? `Connecting ${providerName}` : `Disconnecting ${providerName}`;
    };

    const getDescription = () => {
        if (error) return error;
        if (isReset) return 'Reverting all granular tool permissions to their default states...';
        return isConnect 
            ? 'Waiting for authorization to complete. Please check the popup window...' 
            : 'Revoking access tokens and clearing local cache...';
    };

    const getPrimaryIcon = () => {
        if (error) return <AlertCircle className="w-10 h-10 text-destructive" />;
        if (isReset) return <RotateCcw className="w-10 h-10 text-amber-500 animate-spin-slow" />;
        return isConnect 
            ? <Link2 className="w-10 h-10 text-primary animate-pulse" />
            : <Unlink className="w-10 h-10 text-destructive animate-pulse" />;
    };

    const getPrimaryColorClass = () => {
        if (error) return 'bg-destructive/10 text-destructive border-destructive/20';
        if (isReset) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        return isConnect ? 'bg-primary/10 text-primary border-primary/20' : 'bg-destructive/10 text-destructive border-destructive/20';
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300 text-center relative overflow-hidden">
                
                {/* Background pulse effect */}
                {!error && (
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-3xl opacity-20 animate-pulse ${getPrimaryColorClass().split(' ')[0]}`} />
                )}

                {/* Status Icon */}
                <div className="flex justify-center relative">
                    <div className={`p-5 rounded-2xl ${getPrimaryColorClass()} border relative z-10 shadow-inner`}>
                        {getPrimaryIcon()}
                        
                        {!error && !isReset && icon && (
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-card border-2 border-border shadow-md flex items-center justify-center p-1.5 animate-bounce">
                                <img src={icon} alt={providerName} className="w-full h-full object-contain" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-2 relative z-10">
                    <h3 className="text-xl font-bold text-foreground tracking-tight">
                        {getTitle()}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed px-4">
                        {getDescription()}
                    </p>
                </div>

                {/* Loading indicator line */}
                {!error && (
                    <div className="py-4">
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full animate-[shimmer_2s_infinite] w-full origin-left ${
                                isReset ? 'bg-amber-500' : (isConnect ? 'bg-primary' : 'bg-destructive')
                            }`} />
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 relative z-10 pt-2">
                    {error ? (
                        <>
                            {onRetry && (
                                <button
                                    onClick={onRetry}
                                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                                >
                                    Try Again
                                </button>
                            )}
                            <button
                                onClick={onCancel}
                                className="w-full py-3 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-all border border-border/50"
                            >
                                Close
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onCancel}
                            className="w-full py-2 rounded-xl text-muted-foreground hover:text-foreground font-medium text-xs transition-colors hover:bg-muted/50"
                        >
                            Cancel Request
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
