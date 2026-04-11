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
        iconBgColor: 'bg-blue-50',
        models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
    },
    openai: { 
        label: 'OpenAI', 
        iconBaseColor: 'text-emerald-500', 
        iconBgColor: 'bg-emerald-50',
        models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini']
    },
    anthropic: { 
        label: 'Anthropic', 
        iconBaseColor: 'text-purple-500', 
        iconBgColor: 'bg-purple-50',
        models: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-20240307']
    },
    ollama: { 
        label: 'Ollama', 
        iconBaseColor: 'text-orange-500', 
        iconBgColor: 'bg-orange-50',
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
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/50 border border-gray-200 hover:bg-gray-200 transition-all text-[10px] font-semibold text-gray-700 shadow-sm shrink-0 min-w-0"
            >
                <div className={cn("p-0.5 rounded-full", activeProviderData.iconBgColor)}>
                    <Cpu className={cn("w-2.5 h-2.5", activeProviderData.iconBaseColor)} />
                </div>
                <span className="truncate max-w-[60px]">{model}</span>
                <ChevronDown className="w-2.5 h-2.5 text-gray-400 shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-56 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                    <div className="max-h-80 overflow-y-auto p-1 scrollbar-thin">
                        {(Object.keys(PROVIDER_DATA) as Provider[]).map(pKey => (
                            <div key={pKey} className="mb-1 last:mb-0">
                                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", PROVIDER_DATA[pKey].iconBaseColor.replace('text', 'bg'))} />
                                    {PROVIDER_DATA[pKey].label}
                                </div>
                                {PROVIDER_DATA[pKey].models.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => { onChange(pKey, m); setIsOpen(false); }}
                                        className={cn(
                                            "flex items-center justify-between w-full text-left px-4 py-1.5 rounded-lg text-xs transition-colors mb-0.5",
                                            provider === pKey && model === m 
                                                ? "bg-primary/10 text-primary font-medium" 
                                                : "hover:bg-gray-50 text-gray-700"
                                        )}
                                    >
                                        <span>{m}</span>
                                        {provider === pKey && model === m && <Check className="w-3 h-3" />}
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
