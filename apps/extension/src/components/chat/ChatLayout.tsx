import React from 'react';
import { useTheme } from '../ThemeProvider';
import { Moon, Sun, RefreshCw } from 'lucide-react';
import NavigationMenu, { Page } from '../NavigationMenu';
import iconLight from '../../assets/icon-light.png';
import iconDark from '../../assets/icon-dark.png';

interface ChatLayoutProps {
    children: React.ReactNode;
    currentPage: Page;
    onNavigate: (page: Page) => void;
    status: string;
    onReconnect?: () => void;
}

export function ChatLayout({ children, currentPage, onNavigate, status, onReconnect }: ChatLayoutProps) {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex flex-col h-screen bg-background text-foreground transition-colors duration-300">
            {/* Header - Fixed Background and Visibility */}
            <header className="flex-none border-b border-border bg-card px-4 py-3 z-10 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* Corrected Logo Logic: Dark icon on Light background, Light icon on Dark background */}
                        <img
                            src={iconDark}
                            alt="Extenda"
                            className="h-6 w-auto dark:hidden drop-shadow-sm"
                        />
                        <img
                            src={iconLight}
                            alt="Extenda"
                            className="h-6 w-auto hidden dark:block drop-shadow-sm transition-opacity duration-300"
                        />
                        
                        {/* Connection indicator */}
                        <div className="flex items-center gap-1 ml-1">
                            <div
                                className={`w-2 h-2 rounded-full ${status === 'Connected'
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                    : 'bg-destructive animate-pulse'
                                    }`}
                                title={status}
                            />
                            {status !== 'Connected' && onReconnect && (
                                <button
                                    onClick={onReconnect}
                                    className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-95"
                                    title="Reconnect"
                                >
                                    <RefreshCw size={12} strokeWidth={2.5} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-2 rounded-xl hover:bg-muted text-foreground transition-all active:scale-95"
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />}
                        </button>
                        <NavigationMenu currentPage={currentPage} onNavigate={onNavigate} />
                    </div>
                </div>
            </header>

            {/* Scrollable Content Area */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth bg-background">
                {children}
            </main>
        </div>
    );
}
