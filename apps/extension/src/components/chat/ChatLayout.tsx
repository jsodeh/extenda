import React from 'react';
import { useTheme } from '../ThemeProvider';
import { Moon, Sun, Monitor, Settings, Menu } from 'lucide-react';
import NavigationMenu, { Page } from '../NavigationMenu';
import iconLight from '../../assets/icon-light.png';
import iconDark from '../../assets/icon-dark.png';

interface ChatLayoutProps {
    children: React.ReactNode;
    currentPage: Page;
    onNavigate: (page: Page) => void;
    status: string;
}

export function ChatLayout({ children, currentPage, onNavigate, status }: ChatLayoutProps) {
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${status === 'Connected'
                            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-400'
                            : 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-400'
                            }`}>
                            {status}
                        </span>
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
