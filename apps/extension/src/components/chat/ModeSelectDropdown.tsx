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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border hover:bg-muted transition-all text-[11px] font-bold text-foreground shadow-lg shadow-black/5 shrink-0 active:scale-95"
            >
                {value === 'Fast' ? (
                    <Zap className="text-amber-500 w-3.5 h-3.5 fill-amber-500/20" />
                ) : (
                    <Network className="text-primary w-3.5 h-3.5" />
                )}
                {value}
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-56 rounded-xl shadow-2xl bg-card border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-1.5">
                        <button
                            onClick={() => { onChange('Fast'); setIsOpen(false); }}
                            className={cn(
                                "flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all",
                                value === 'Fast' 
                                    ? "bg-amber-500/10 text-amber-500 font-bold" 
                                    : "text-foreground hover:bg-muted"
                            )}
                        >
                            <Zap className={cn("w-4 h-4 mt-0.5 shrink-0", value === 'Fast' ? "fill-amber-500/20" : "text-amber-500")} />
                            <div>
                                <span className={cn("block text-xs", value === 'Fast' ? "" : "font-semibold")}>Fast (1-Step)</span>
                                <span className="block text-[10px] opacity-60 mt-0.5 leading-tight">Quick responses, bypass planning phase.</span>
                            </div>
                        </button>
                        <button
                            onClick={() => { onChange('Planning'); setIsOpen(false); }}
                            className={cn(
                                "flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all mt-1",
                                value === 'Planning' 
                                    ? "bg-primary/10 text-primary font-bold" 
                                    : "text-foreground hover:bg-muted"
                            )}
                        >
                            <Network className={cn("w-4 h-4 mt-0.5 shrink-0", value === 'Planning' ? "" : "text-primary")} />
                            <div>
                                <span className={cn("block text-xs", value === 'Planning' ? "" : "font-semibold")}>Planning Mode</span>
                                <span className="block text-[10px] opacity-60 mt-0.5 leading-tight">Deep reasoning, multi-step orchestration.</span>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
