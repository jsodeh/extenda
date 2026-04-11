import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, Save, Key, Zap, CheckCircle2 } from 'lucide-react';
import IntegrationsPage from './IntegrationsPage';

interface SettingsSection {
    id: string;
    label: string;
}

const SECTIONS: SettingsSection[] = [
    { id: 'integrations', label: 'Integrations' },
    { id: 'model', label: 'AI Models & BYOK' },
    { id: 'prompts', label: 'Prompts & Behavior' },
    { id: 'general', label: 'General' },
];

interface SettingsPageProps {
    onBack?: () => void;
}

// Map structure to store multiple keys securely in local storage
interface KeyStorage {
    google: string;
    openai: string;
    anthropic: string;
    ollama: string;
}

interface DefaultModels {
    google: string;
    openai: string;
    anthropic: string;
    ollama: string;
}

const PROVIDER_MODELS = {
    google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'],
    anthropic: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-20240307'],
    ollama: ['llama3', 'gemma3:4b', 'mistral', 'codellama', 'phi3']
};

export default function SettingsPage({ onBack }: SettingsPageProps) {
    const [activeSection, setActiveSection] = useState('root');
    const [providerKeys, setProviderKeys] = useState<KeyStorage>({ google: '', openai: '', anthropic: '', ollama: '' });
    const [defaultModels, setDefaultModels] = useState<DefaultModels>({ 
        google: 'gemini-2.0-flash', 
        openai: 'gpt-4o', 
        anthropic: 'claude-3-5-sonnet-latest', 
        ollama: 'llama3' 
    });
    const [selectedProvider, setSelectedProvider] = useState<keyof KeyStorage>('google');
    const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
    
    // Legacy states
    const [autoExecute, setAutoExecute] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [customPrompt, setCustomPrompt] = useState('');
    const [promptStyle, setPromptStyle] = useState('professional');
    const [saved, setSaved] = useState(false);
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    useEffect(() => {
        // Load API keys from Chrome local storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get([
                'extenda_provider_keys', 
                'extenda_active_provider', 
                'extenda_default_models',
                'extenda_ollama_url'
            ], (result) => {
                if (result.extenda_provider_keys) setProviderKeys(result.extenda_provider_keys);
                if (result.extenda_active_provider) setSelectedProvider(result.extenda_active_provider);
                if (result.extenda_default_models) setDefaultModels(result.extenda_default_models);
                if (result.extenda_ollama_url) setOllamaUrl(result.extenda_ollama_url);
            });
        }

        const fetchPreferences = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return;

            try {
                const response = await fetch(`${API_URL}/api/preferences`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.customPrompt) setCustomPrompt(data.customPrompt);
                    if (data.promptStyle) setPromptStyle(data.promptStyle);
                }
            } catch (error) {
                console.error('Failed to load preferences:', error);
            }
        };
        fetchPreferences();
    }, []);

    const handleSave = async () => {
        // 1. Save Keys Locally
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({ 
                extenda_provider_keys: providerKeys,
                extenda_active_provider: selectedProvider,
                extenda_default_models: defaultModels,
                extenda_ollama_url: ollamaUrl
            });
        }

        // 2. Save Preferences to Backend
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/preferences`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    customPrompt,
                    promptStyle,
                })
            });

            if (response.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    };

    const handleKeyChange = (provider: keyof KeyStorage, val: string) => {
        setProviderKeys(prev => ({ ...prev, [provider]: val }));
    };

    const handleModelChange = (provider: keyof DefaultModels, val: string) => {
        setDefaultModels(prev => ({ ...prev, [provider]: val }));
    };

    const ProviderCard = ({ id, name, desc }: { id: keyof KeyStorage, name: string, desc: string }) => {
        const isActive = selectedProvider === id;
        const hasKey = id === 'ollama' 
            ? ollamaUrl.startsWith('http') 
            : providerKeys[id]?.length > 10;
        
        return (
            <div 
                onClick={() => setSelectedProvider(id)}
                className={`flex flex-col relative p-4 rounded-xl border-2 cursor-pointer transition-all min-h-[160px] ${
                    isActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                }`}
            >
                <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-semibold text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>{name}</h3>
                    {hasKey && <CheckCircle2 className="w-4 h-4 text-emerald-500 bg-background rounded-full" />}
                </div>
                <p className="text-[10px] text-muted-foreground mb-3 h-6 line-clamp-2">{desc}</p>
                
                {isActive && (
                    <div className="mt-auto space-y-2" onClick={(e) => e.stopPropagation()}>
                        {id === 'ollama' ? (
                            <input
                                type="text"
                                placeholder="Base URL (http://...)"
                                value={ollamaUrl}
                                onChange={(e) => setOllamaUrl(e.target.value)}
                                className="bg-muted/50 block w-full px-3 py-1.5 border border-border rounded-lg text-[11px] text-foreground focus:ring-primary focus:border-primary placeholder-muted-foreground transition-all"
                            />
                        ) : (
                            <div className="relative">
                                <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <input
                                    type="password"
                                    placeholder="API Key"
                                    value={providerKeys[id]}
                                    onChange={(e) => handleKeyChange(id, e.target.value)}
                                    className="bg-muted/50 block w-full pl-8 pr-3 py-1.5 border border-border rounded-lg text-[11px] text-foreground focus:ring-primary focus:border-primary placeholder-muted-foreground transition-all"
                                />
                            </div>
                        )}
                        
                        <select
                            value={defaultModels[id as keyof DefaultModels]}
                            onChange={(e) => handleModelChange(id as keyof DefaultModels, e.target.value)}
                            className="bg-background block w-full px-2 py-1.5 border border-border rounded-lg text-[11px] text-foreground focus:ring-primary focus:border-primary cursor-pointer"
                        >
                            {PROVIDER_MODELS[id as keyof typeof PROVIDER_MODELS].map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Header */}
            <div className="border-b border-border bg-background/80 backdrop-blur-md px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
                <button
                    onClick={() => {
                        if (activeSection === 'root') {
                            onBack?.();
                        } else {
                            setActiveSection('root');
                        }
                    }}
                    className="p-1.5 -ml-1.5 rounded-full hover:bg-muted transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </button>
                <h1 className="text-[17px] font-semibold text-foreground tracking-tight">
                    {activeSection === 'root' ? 'Settings' : SECTIONS.find(s => s.id === activeSection)?.label}
                </h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto">
                {activeSection === 'root' ? (
                    <div className="p-4 space-y-2.5">
                        {SECTIONS.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className="w-full flex items-center justify-between p-4 bg-card rounded-xl shadow-sm border border-border hover:border-primary/20 hover:shadow-md transition-all group"
                            >
                                <span className="font-medium text-sm text-foreground">{section.label}</span>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        {activeSection === 'integrations' && (
                            <div className="flex-1 overflow-hidden">
                                <IntegrationsPage />
                            </div>
                        )}

                        {activeSection === 'model' && (
                            <div className="p-5 space-y-6">
                                <div className="space-y-1 w-full text-center sm:text-left">
                                    <h2 className="text-sm font-semibold text-foreground">
                                        {selectedProvider === 'ollama' ? 'Local AI Configuration' : 'Bring Your Own Key'}
                                    </h2>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {selectedProvider === 'ollama' 
                                            ? 'Extenda connects directly to your local Ollama instance. Ensure Ollama is running on your machine.' 
                                            : 'Extenda runs securely on your own API keys. Keys are saved locally to your device and directly passed to the vendor.'}
                                    </p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 w-full">
                                    <ProviderCard id="google" name="Google" desc="Access to Gemini 2.0 Flash & Pro." />
                                    <ProviderCard id="openai" name="OpenAI" desc="Access to GPT-4o and o1 models." />
                                    <ProviderCard id="anthropic" name="Anthropic" desc="Access to Claude 3.5 Sonnet." />
                                    <ProviderCard id="ollama" name="Ollama" desc="Local LLMs on your own machine." />
                                </div>
                            </div>
                        )}

                        {activeSection === 'prompts' && (
                            <div className="p-5 space-y-8">
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-foreground">
                                        Response Target Stylings
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['professional', 'casual', 'concise', 'detailed'].map((style) => (
                                            <button
                                                key={style}
                                                onClick={() => setPromptStyle(style)}
                                                className={`px-4 py-3 rounded-xl border text-sm font-medium capitalize transition-all ${
                                                    promptStyle === style 
                                                        ? 'border-primary bg-primary text-primary-foreground shadow-md' 
                                                        : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                                                }`}
                                            >
                                                {style}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-foreground">
                                        Global System Execution Prompt
                                    </label>
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="E.g. Always write code in Python. Always respond natively in Spanish. Do not use emojis."
                                        rows={6}
                                        className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none shadow-sm placeholder:text-muted-foreground"
                                    />
                                    <p className="text-xs text-muted-foreground">Injected into the orchestrator context block for every prompt.</p>
                                </div>
                            </div>
                        )}

                        {activeSection === 'general' && (
                            <div className="p-5 space-y-2">
                                <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border shadow-sm">
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground">Auto-execute Workflows</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Run generated code actions instantly
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setAutoExecute(!autoExecute)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoExecute ? 'bg-primary' : 'bg-muted'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-background ring-0 transition-transform ${autoExecute ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border shadow-sm">
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground">Push Notifications</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Alert me when tasks complete in background
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setNotifications(!notifications)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications ? 'bg-primary' : 'bg-muted'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-background ring-0 transition-transform ${notifications ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Save Button */}
                        {activeSection !== 'integrations' && (
                            <div className="p-5 mt-auto">
                                <button
                                    onClick={handleSave}
                                    className={`w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-lg font-semibold text-sm transition-all focus:outline-none focus:ring-4 focus:ring-primary/20 ${saved
                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                        : 'bg-foreground text-background hover:opacity-90 active:scale-95'
                                        }`}
                                >
                                    {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                                    <span>{saved ? 'Preferences Saved' : 'Save & Sync Settings'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
