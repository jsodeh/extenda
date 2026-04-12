import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, Save, Key, CheckCircle2, Eye, EyeOff, Globe } from 'lucide-react';
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
    const [showKey, setShowKey] = useState(false);
    
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

    // --- Provider Card ---
    const ProviderCard = ({ id, name, desc }: { id: keyof KeyStorage, name: string, desc: string }) => {
        const isActive = selectedProvider === id;
        const hasKey = id === 'ollama' 
            ? ollamaUrl.startsWith('http') 
            : providerKeys[id]?.length > 10;
        
        return (
            <button
                type="button"
                onClick={() => setSelectedProvider(id)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    isActive 
                        ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/30' 
                        : 'border-border bg-card hover:border-muted-foreground/30'
                }`}
            >
                <div className="flex items-center justify-between">
                    <h3 className={`font-semibold text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>{name}</h3>
                    {hasKey && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{desc}</p>
            </button>
        );
    };

    // --- Render Active Provider Config ---
    const renderProviderConfig = () => {
        const id = selectedProvider;
        const isOllama = id === 'ollama';

        return (
            <div className="mt-5 space-y-4 p-4 bg-card rounded-xl border border-border">
                <h3 className="text-sm font-semibold text-foreground">
                    {isOllama ? '🖥️ Ollama Local Setup' : `🔑 ${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} API Key`}
                </h3>
                
                {isOllama ? (
                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-foreground">
                            Base URL
                        </label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="http://localhost:11434"
                                value={ollamaUrl}
                                onChange={(e) => setOllamaUrl(e.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 rounded-lg border-2 border-border bg-background text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Enter your Ollama server URL. Default: http://localhost:11434
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-foreground">
                            API Key
                        </label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type={showKey ? 'text' : 'password'}
                                placeholder="Paste your API key here..."
                                value={providerKeys[id]}
                                onChange={(e) => handleKeyChange(id, e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-border bg-background text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Your key is stored locally in your browser. Never sent to our servers.
                        </p>
                    </div>
                )}

                {/* Model Selection */}
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-foreground">
                        Default Model
                    </label>
                    <select
                        value={defaultModels[id as keyof DefaultModels]}
                        onChange={(e) => handleModelChange(id as keyof DefaultModels, e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border-2 border-border bg-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer transition-all"
                    >
                        {PROVIDER_MODELS[id as keyof typeof PROVIDER_MODELS].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                {/* Current value indicator */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/50">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                        isOllama 
                            ? (ollamaUrl.startsWith('http') ? 'bg-emerald-500' : 'bg-amber-500')
                            : (providerKeys[id]?.length > 10 ? 'bg-emerald-500' : 'bg-amber-500')
                    }`} />
                    <span className="text-[10px] text-muted-foreground truncate">
                        {isOllama 
                            ? (ollamaUrl ? `URL: ${ollamaUrl}` : 'No URL configured') 
                            : (providerKeys[id]?.length > 10 
                                ? `Key: ${providerKeys[id].slice(0, 8)}${'•'.repeat(12)}` 
                                : 'No API key configured')}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Header */}
            <div className="border-b border-border bg-card px-4 py-4 sticky top-0 z-10 flex items-center gap-3 shadow-sm">
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
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                </button>
                <h1 className="text-base font-semibold text-foreground tracking-tight">
                    {activeSection === 'root' ? 'Settings' : SECTIONS.find(s => s.id === activeSection)?.label}
                </h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeSection === 'root' ? (
                    <div className="p-4 space-y-2">
                        {SECTIONS.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all group"
                            >
                                <span className="font-medium text-sm text-foreground">{section.label}</span>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col min-h-full">
                        {activeSection === 'integrations' && (
                            <div className="flex-1 overflow-hidden">
                                <IntegrationsPage />
                            </div>
                        )}

                        {activeSection === 'model' && (
                            <div className="p-4 space-y-4">
                                <div className="space-y-1">
                                    <h2 className="text-sm font-semibold text-foreground">
                                        {selectedProvider === 'ollama' ? 'Local AI Configuration' : 'Bring Your Own Key'}
                                    </h2>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {selectedProvider === 'ollama' 
                                            ? 'Connect to your local Ollama instance. No API key needed.' 
                                            : 'Keys are stored locally on your device. We never see or store them.'}
                                    </p>
                                </div>
                                
                                {/* Provider Selector */}
                                <div className="grid grid-cols-2 gap-2">
                                    <ProviderCard id="google" name="Google" desc="Gemini 2.0 Flash & Pro" />
                                    <ProviderCard id="openai" name="OpenAI" desc="GPT-4o and o1 models" />
                                    <ProviderCard id="anthropic" name="Anthropic" desc="Claude 3.5 Sonnet" />
                                    <ProviderCard id="ollama" name="Ollama" desc="Local LLMs on your machine" />
                                </div>

                                {/* Active Provider Configuration */}
                                {renderProviderConfig()}
                            </div>
                        )}

                        {activeSection === 'prompts' && (
                            <div className="p-4 space-y-6">
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-foreground">
                                        Response Style
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['professional', 'casual', 'concise', 'detailed'].map((style) => (
                                            <button
                                                key={style}
                                                onClick={() => setPromptStyle(style)}
                                                className={`px-4 py-3 rounded-xl border-2 text-sm font-medium capitalize transition-all ${
                                                    promptStyle === style 
                                                        ? 'border-primary bg-primary text-primary-foreground shadow-md' 
                                                        : 'border-border bg-card text-foreground hover:border-primary/30'
                                                }`}
                                            >
                                                {style}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-foreground">
                                        Custom System Prompt
                                    </label>
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="E.g. Always write code in Python. Always respond in Spanish."
                                        rows={5}
                                        className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                                    />
                                    <p className="text-[10px] text-muted-foreground">Applied to every AI interaction.</p>
                                </div>
                            </div>
                        )}

                        {activeSection === 'general' && (
                            <div className="p-4 space-y-2">
                                {/* Auto-execute toggle */}
                                <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground">Auto-execute Workflows</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Run generated code actions instantly
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAutoExecute(!autoExecute)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors ${
                                            autoExecute ? 'bg-primary border-primary' : 'bg-muted border-border'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                                            autoExecute 
                                                ? 'translate-x-[22px] bg-primary-foreground' 
                                                : 'translate-x-[2px] bg-muted-foreground'
                                        }`} />
                                    </button>
                                </div>

                                {/* Push Notifications toggle */}
                                <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground">Push Notifications</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Alert me when tasks complete in background
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setNotifications(!notifications)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors ${
                                            notifications ? 'bg-primary border-primary' : 'bg-muted border-border'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                                            notifications 
                                                ? 'translate-x-[22px] bg-primary-foreground' 
                                                : 'translate-x-[2px] bg-muted-foreground'
                                        }`} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Save Button - always visible except on integrations */}
                        {activeSection !== 'integrations' && (
                            <div className="p-4 mt-auto sticky bottom-0 bg-background border-t border-border">
                                <button
                                    onClick={handleSave}
                                    className={`w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${saved
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30'
                                    }`}
                                >
                                    {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                                    <span>{saved ? 'Saved ✓' : 'Save & Sync Settings'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
