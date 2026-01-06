import React from 'react';
import { useAppStore } from '../store';
import { Settings, History, Map, FileText, X } from 'lucide-react';

export const Menu: React.FC = () => {
    const { isMenuOpen, toggleMenu } = useAppStore();

    if (!isMenuOpen) return null;

    return (
        <div className="absolute top-0 right-0 z-50 h-full w-64 bg-white shadow-2xl transition-transform duration-300 transform translate-x-0 border-l border-slate-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Menu</h2>
                <button onClick={toggleMenu} className="p-1 hover:bg-slate-100 rounded">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
            </div>
            <nav className="p-2 space-y-1">
                <MenuItem icon={<History className="w-4 h-4" />} label="History" />
                <MenuItem icon={<Map className="w-4 h-4" />} label="Workflows" />
                <MenuItem icon={<FileText className="w-4 h-4" />} label="Prompt Library" />
                <div className="my-2 border-t border-slate-100"></div>
                <MenuItem icon={<Settings className="w-4 h-4" />} label="Settings" />
            </nav>
        </div>
    );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <button className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md transition-colors">
        {icon}
        <span>{label}</span>
    </button>
);
