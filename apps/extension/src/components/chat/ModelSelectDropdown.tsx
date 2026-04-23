import React from 'react';
import { Cpu, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export type Provider = 'google' | 'openai' | 'anthropic' | 'ollama';

interface ModelSelectDropdownProps {
    provider: Provider;
    model: string;
    onChange: (provider: Provider, model: string) => void;
}

const PROVIDER_DATA: Record<Provider, { label: string; iconBaseColor: string; iconBgColor: string; models: string[] }> = {
    google: { 
        label: 'Google', 
        iconBaseColor: 'text-blue-500', 
        iconBgColor: 'bg-blue-500/10',
        models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.0-pro']
    },
    openai: { 
        label: 'OpenAI', 
        iconBaseColor: 'text-emerald-500', 
        iconBgColor: 'bg-emerald-500/10',
        models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini']
    },
    anthropic: { 
        label: 'Anthropic', 
        iconBaseColor: 'text-purple-500', 
        iconBgColor: 'bg-purple-500/10',
        models: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-20240307']
    },
    ollama: { 
        label: 'Ollama', 
        iconBaseColor: 'text-orange-500', 
        iconBgColor: 'bg-orange-500/10',
        models: ['llama3', 'gemma3:4b', 'mistral', 'codellama', 'phi3']
    }
};

export function ModelSelectDropdown({ provider, model, onChange }: ModelSelectDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    // Close when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => setIsOpen(false);
        if (isOpen) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isOpen]);

    const activeProviderData = PROVIDER_DATA[provider];

    return (
        <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border hover:bg-muted transition-all text-[10px] font-bold text-foreground shadow-lg shadow-black/5 shrink-0 min-w-0 active:scale-95"
            >
                <div className={cn("p-0.5 rounded-full", activeProviderData.iconBgColor)}>
                    <Cpu className={cn("w-3 h-3", activeProviderData.iconBaseColor)} />
                </div>
                <span className="truncate max-w-[80px]">{model}</span>
                <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-64 rounded-xl shadow-2xl bg-card border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="max-h-80 overflow-y-auto p-1.5 no-scrollbar">
                        {(Object.keys(PROVIDER_DATA) as Provider[]).map(pKey => (
                            <div key={pKey} className="mb-2 last:mb-0">
                                <div className="px-3 py-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", PROVIDER_DATA[pKey].iconBaseColor.replace('text', 'bg'))} />
                                    {PROVIDER_DATA[pKey].label}
                                </div>
                                {PROVIDER_DATA[pKey].models.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => { onChange(pKey, m); setIsOpen(false); }}
                                        className={cn(
                                            "flex items-center justify-between w-full text-left px-4 py-2 rounded-lg text-xs transition-all mb-0.5",
                                            provider === pKey && model === m 
                                                ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20" 
                                                : "text-foreground hover:bg-muted hover:pl-5"
                                        )}
                                    >
                                        <span className="truncate">{m}</span>
                                        {provider === pKey && model === m && <Check className="w-3 h-3 shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
