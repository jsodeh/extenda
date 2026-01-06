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
            {/* Header - Fixed */}
            <header className="flex-none border-b border-border bg-card/50 backdrop-blur-sm px-4 py-3 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img
                            src={iconLight}
                            alt="Extenda"
                            className="h-6 w-auto dark:hidden drop-shadow-md"
                        />
                        <img
                            src={iconDark}
                            alt="Extenda"
                            className="h-6 w-auto hidden dark:block drop-shadow-md"
                        />
                        {/* Connection indicator */}
                        <div className="flex items-center gap-1">
                            <div
                                className={`w-2 h-2 rounded-full ${status === 'Connected'
                                    ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]'
                                    : 'bg-red-400'
                                    }`}
                                title={status}
                            />
                            {status !== 'Connected' && onReconnect && (
                                <button
                                    onClick={onReconnect}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                                    title="Reconnect"
                                >
                                    <RefreshCw size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                        </button>
                        <NavigationMenu currentPage={currentPage} onNavigate={onNavigate} />
                    </div>
                </div>
            </header>

            {/* Scrollable Content Area */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
                {children}
            </main>
        </div>
    );
}
