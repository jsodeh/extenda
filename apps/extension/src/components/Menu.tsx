import React from 'react';
import { useAppStore } from '../store';
import { Settings, History, Map, FileText, X } from 'lucide-react';

export const Menu: React.FC = () => {
    const { isMenuOpen, toggleMenu } = useAppStore();

    if (!isMenuOpen) return null;

    return (
        <div className="absolute top-0 right-0 z-50 h-full w-64 bg-card shadow-2xl transition-transform duration-300 transform translate-x-0 border-l border-border">
            <div className="flex justify-between items-center p-4 border-b border-border">
                <h2 className="font-bold text-foreground">Menu</h2>
                <button onClick={toggleMenu} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                </button>
            </div>
            <nav className="p-3 space-y-1">
                <MenuItem icon={<History className="w-4 h-4" />} label="History" />
                <MenuItem icon={<Map className="w-4 h-4" />} label="Workflows" />
                <MenuItem icon={<FileText className="w-4 h-4" />} label="Prompt Library" />
                <div className="my-3 border-t border-border/50"></div>
                <MenuItem icon={<Settings className="w-4 h-4" />} label="Settings" />
            </nav>
        </div>
    );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted rounded-xl transition-all active:scale-95">
        <span className="text-primary">{icon}</span>
        <span>{label}</span>
    </button>
);
