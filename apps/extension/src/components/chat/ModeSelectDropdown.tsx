import React from 'react';
import { Network, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ExecutionMode = 'Fast' | 'Planning';

interface ModeSelectDropdownProps {
    value: ExecutionMode;
    onChange: (mode: ExecutionMode) => void;
}

export function ModeSelectDropdown({ value, onChange }: ModeSelectDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    // Close when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => setIsOpen(false);
        if (isOpen) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/50 border border-gray-200 hover:bg-gray-200 transition-all text-[11px] font-semibold text-gray-700 shadow-sm shrink-0"
            >
                {value === 'Fast' ? <Zap className="text-amber-500 w-3 h-3" /> : <Network className="text-blue-500 w-3 h-3" />}
                {value}
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-1">
                        <button
                            onClick={() => { onChange('Fast'); setIsOpen(false); }}
                            className={cn(
                                "flex items-start gap-2 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                                value === 'Fast' ? "bg-amber-50 text-amber-900" : "hover:bg-gray-50 text-gray-700"
                            )}
                        >
                            <Zap className="text-amber-500 w-4 h-4 mt-0.5" />
                            <div>
                                <span className="block font-medium">Fast (1-Step)</span>
                                <span className="block text-[10px] opacity-70 mt-0.5">Quick responses, bypass planning phase.</span>
                            </div>
                        </button>
                        <button
                            onClick={() => { onChange('Planning'); setIsOpen(false); }}
                            className={cn(
                                "flex items-start gap-2 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mt-1",
                                value === 'Planning' ? "bg-blue-50 text-blue-900" : "hover:bg-gray-50 text-gray-700"
                            )}
                        >
                            <Network className="text-blue-500 w-4 h-4 mt-0.5" />
                            <div>
                                <span className="block font-medium">Planning</span>
                                <span className="block text-[10px] opacity-70 mt-0.5">Deep reasoning, multi-step orchestration.</span>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
