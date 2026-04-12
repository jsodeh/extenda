import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
                    <div className="bg-card rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-border text-center">
                        <div className="flex flex-col items-center gap-4 mb-6">
                            <div className="p-3 bg-destructive/10 rounded-full">
                                <AlertTriangle className="h-8 w-8 text-destructive" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
                        </div>

                        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                            We encountered an unexpected error. Please try refreshing or restarting the application.
                        </p>

                        {this.state.error && (
                            <div className="bg-muted/50 rounded-xl p-3 mb-6 border border-border/50">
                                <p className="text-[10px] font-mono text-muted-foreground break-all text-left line-clamp-3">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={this.handleReset}
                                className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-muted text-foreground rounded-xl font-bold text-sm hover:bg-muted/80 transition-all active:scale-95 border border-border"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Reload Application
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
