import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/auth-context';
import { ArrowLeft, ChevronRight, Save, Key, CheckCircle2, Eye, EyeOff, Globe, User, LogOut } from 'lucide-react';
import IntegrationsPage from './IntegrationsPage';
import ProfilePage from './ProfilePage';

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

// --- Helper Components Moved Outside to Prevent Focus Loss ---

const ProviderCard = ({ 
    id, 
    name, 
    desc, 
    isActive, 
    hasKey, 
    onSelect 
}: { 
    id: keyof KeyStorage, 
    name: string, 
    desc: string,
    isActive: boolean,
    hasKey: boolean,
    onSelect: (id: keyof KeyStorage) => void
}) => {
    return (
        <button
            type="button"
            onClick={() => onSelect(id)}
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

const ProviderConfig = ({
    selectedProvider,
    ollamaUrl,
    setOllamaUrl,
    providerKeys,
    handleKeyChange,
    showKey,
    setShowKey,
    defaultModels,
    handleModelChange
}: {
    selectedProvider: keyof KeyStorage,
    ollamaUrl: string,
    setOllamaUrl: (val: string) => void,
    providerKeys: KeyStorage,
    handleKeyChange: (provider: keyof KeyStorage, val: string) => void,
    showKey: boolean,
    setShowKey: (val: boolean) => void,
    defaultModels: DefaultModels,
    handleModelChange: (provider: keyof DefaultModels, val: string) => void
}) => {
    const isOllama = selectedProvider === 'ollama';

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
                            className="w-full pl-10 pr-3 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                    </div>
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
                            value={providerKeys[selectedProvider]}
                            onChange={(e) => handleKeyChange(selectedProvider, e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <label className="block text-xs font-medium text-foreground">
                    Default Model
                </label>
                <select
                    value={defaultModels[selectedProvider as keyof DefaultModels]}
                    onChange={(e) => handleModelChange(selectedProvider as keyof DefaultModels, e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer transition-all"
                >
                    {PROVIDER_MODELS[selectedProvider as keyof typeof PROVIDER_MODELS].map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                    isOllama 
                        ? (ollamaUrl.startsWith('http') ? 'bg-emerald-500' : 'bg-amber-500')
                        : (providerKeys[selectedProvider]?.length > 10 ? 'bg-emerald-500' : 'bg-amber-500')
                }`} />
                <span className="text-[10px] text-muted-foreground truncate font-medium">
                    {isOllama 
                        ? (ollamaUrl ? `URL: ${ollamaUrl}` : 'No URL configured') 
                        : (providerKeys[selectedProvider]?.length > 10 
                            ? `Key: ${providerKeys[selectedProvider].slice(0, 8)}${'•'.repeat(12)}` 
                            : 'No API key configured')}
                </span>
            </div>
        </div>
    );
};

// --- Main Page ---

interface SettingsPageProps {
    onBack?: () => void;
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
    const { user } = useAuth();
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
    const [backendUrl, setBackendUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:3000');
    const [showKey, setShowKey] = useState(false);
    
    // Legacy states
    const [autoExecute, setAutoExecute] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [customPrompt, setCustomPrompt] = useState('');
    const [promptStyle, setPromptStyle] = useState('professional');
    const [saved, setSaved] = useState(false);
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    useEffect(() => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get([
                'extenda_provider_keys', 
                'extenda_active_provider', 
                'extenda_default_models',
                'extenda_ollama_url',
                'extenda_backend_url'
            ], (result) => {
                if (result.extenda_provider_keys) setProviderKeys(result.extenda_provider_keys);
                if (result.extenda_active_provider) setSelectedProvider(result.extenda_active_provider);
                if (result.extenda_default_models) setDefaultModels(result.extenda_default_models);
                if (result.extenda_ollama_url) setOllamaUrl(result.extenda_ollama_url);
                if (result.extenda_backend_url) setBackendUrl(result.extenda_backend_url);
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
        if (typeof chrome !== 'undefined' && chrome.storage) {
            // Always save model/provider settings (these should NOT trigger a reload)
            await chrome.storage.local.set({ 
                extenda_provider_keys: providerKeys,
                extenda_active_provider: selectedProvider,
                extenda_default_models: defaultModels,
                extenda_ollama_url: ollamaUrl
            });

            // Only write backend URL if it actually changed, to avoid
            // triggering the storage listener in App.tsx which does a full reload
            const current = await chrome.storage.local.get(['extenda_backend_url']);
            if (current.extenda_backend_url !== backendUrl) {
                await chrome.storage.local.set({ extenda_backend_url: backendUrl });
            }
        }

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
                body: JSON.stringify({ customPrompt, promptStyle })
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
                    <div className="p-4 space-y-4">
                        {/* Profile Widget */}
                        <button
                            onClick={() => setActiveSection('profile')}
                            className="w-full flex items-center justify-between p-5 rounded-3xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 active:scale-[0.98] transition-all group"
                        >
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-80">Connected as</span>
                                <h3 className="text-sm font-bold truncate max-w-[140px]">
                                    {user?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}` : (user?.email?.split('@')[0] || 'Extenda User'))}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[10px] font-medium opacity-80">Active Session</span>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/20 overflow-hidden shadow-inner group-hover:scale-105 transition-transform">
                                    {user?.imageUrl ? (
                                        <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-6 h-6 text-primary-foreground" />
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-lg">
                                    <ChevronRight className="w-3 h-3 text-primary stroke-[3]" />
                                </div>
                            </div>
                        </button>

                        <div className="space-y-2 pt-2">
                            {SECTIONS.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className="w-full flex items-center justify-between p-4 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-md transition-all group"
                                >
                                    <span className="font-medium text-sm text-foreground">{section.label}</span>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col min-h-full">
                        {activeSection === 'profile' && (
                            <ProfilePage onBack={() => setActiveSection('root')} />
                        )}

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
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <ProviderCard 
                                        id="google" 
                                        name="Google" 
                                        desc="Gemini 2.0 Flash & Pro" 
                                        isActive={selectedProvider === 'google'}
                                        hasKey={providerKeys.google?.length > 10}
                                        onSelect={setSelectedProvider}
                                    />
                                    <ProviderCard 
                                        id="openai" 
                                        name="OpenAI" 
                                        desc="GPT-4o and o1 models" 
                                        isActive={selectedProvider === 'openai'}
                                        hasKey={providerKeys.openai?.length > 10}
                                        onSelect={setSelectedProvider}
                                    />
                                    <ProviderCard 
                                        id="anthropic" 
                                        name="Anthropic" 
                                        desc="Claude 3.5 Sonnet" 
                                        isActive={selectedProvider === 'anthropic'}
                                        hasKey={providerKeys.anthropic?.length > 10}
                                        onSelect={setSelectedProvider}
                                    />
                                    <ProviderCard 
                                        id="ollama" 
                                        name="Ollama" 
                                        desc="Local LLMs on your machine" 
                                        isActive={selectedProvider === 'ollama'}
                                        hasKey={ollamaUrl.startsWith('http')}
                                        onSelect={setSelectedProvider}
                                    />
                                </div>

                                <ProviderConfig 
                                    selectedProvider={selectedProvider}
                                    ollamaUrl={ollamaUrl}
                                    setOllamaUrl={setOllamaUrl}
                                    providerKeys={providerKeys}
                                    handleKeyChange={handleKeyChange}
                                    showKey={showKey}
                                    setShowKey={setShowKey}
                                    defaultModels={defaultModels}
                                    handleModelChange={handleModelChange}
                                />
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
                                        className="w-full rounded-xl border-2 border-border bg-background text-foreground px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'general' && (
                            <div className="p-4 space-y-4">
                                {/* Backend API URL - Moved to Top */}
                                <div className="p-4 bg-card rounded-xl border-2 border-primary/30 space-y-3 shadow-md">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-primary/10">
                                            <Save className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-foreground">Backend API URL</h4>
                                            <p className="text-[10px] text-muted-foreground">Current: {backendUrl.includes('render') ? 'Cloud' : 'Local'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={backendUrl}
                                            onChange={(e) => setBackendUrl(e.target.value)}
                                            placeholder="http://localhost:3000"
                                            className="w-full px-3 py-2.5 rounded-lg border-2 border-border bg-background text-foreground text-sm font-mono focus:border-primary transition-all"
                                        />
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setBackendUrl('https://extenda-pxa6.onrender.com')}
                                                className="flex-1 text-[10px] font-bold py-2 bg-muted rounded-lg hover:bg-muted-foreground/10 text-foreground transition-all"
                                            >
                                                Use Cloud
                                            </button>
                                            <button 
                                                onClick={() => setBackendUrl('http://localhost:3000')}
                                                className="flex-1 text-[10px] font-bold py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all border border-primary/20"
                                            >
                                                Use Local (3000)
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground">Auto-execute Workflows</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">Run generated code actions instantly</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAutoExecute(!autoExecute)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors ${
                                            autoExecute ? 'bg-primary border-primary' : 'bg-muted border-border'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                                            autoExecute ? 'translate-x-[22px] bg-primary-foreground' : 'translate-x-[2px] bg-muted-foreground'
                                        }`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground">Push Notifications</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">Alert me when tasks complete</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setNotifications(!notifications)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors ${
                                            notifications ? 'bg-primary border-primary' : 'bg-muted border-border'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                                            notifications ? 'translate-x-[22px] bg-primary-foreground' : 'translate-x-[2px] bg-muted-foreground'
                                        }`} />
                                    </button>
                                </div>
                            </div>
                        )}

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
