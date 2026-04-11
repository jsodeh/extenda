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
        const hasKey = id === 'ollama' ? true : providerKeys[id]?.length > 10;
        
        return (
            <div 
                onClick={() => setSelectedProvider(id)}
                className={`flex flex-col relative p-4 rounded-xl border-2 cursor-pointer transition-all min-h-[160px] ${
                    isActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                }`}
            >
                <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-semibold text-sm ${isActive ? 'text-primary' : 'text-gray-800'}`}>{name}</h3>
                    {hasKey && <CheckCircle2 className="w-4 h-4 text-emerald-500 bg-white rounded-full" />}
                </div>
                <p className="text-[10px] text-gray-500 mb-3 h-6 line-clamp-2">{desc}</p>
                
                {isActive && (
                    <div className="mt-auto space-y-2" onClick={(e) => e.stopPropagation()}>
                        {id === 'ollama' ? (
                            <input
                                type="text"
                                placeholder="Base URL (http://...)"
                                value={ollamaUrl}
                                onChange={(e) => setOllamaUrl(e.target.value)}
                                className="bg-white block w-full px-3 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:ring-primary focus:border-primary placeholder-gray-400"
                            />
                        ) : (
                            <div className="relative">
                                <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                                <input
                                    type="password"
                                    placeholder="API Key"
                                    value={providerKeys[id]}
                                    onChange={(e) => handleKeyChange(id, e.target.value)}
                                    className="bg-white block w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:ring-primary focus:border-primary placeholder-gray-400"
                                />
                            </div>
                        )}
                        
                        <select
                            value={defaultModels[id as keyof DefaultModels]}
                            onChange={(e) => handleModelChange(id as keyof DefaultModels, e.target.value)}
                            className="bg-white block w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] text-gray-700 focus:ring-primary focus:border-primary"
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
        <div className="flex flex-col h-screen bg-gray-50/50">
            {/* Header */}
            <div className="border-b border-gray-100 bg-white/80 backdrop-blur-md px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
                <button
                    onClick={() => {
                        if (activeSection === 'root') {
                            onBack?.();
                        } else {
                            setActiveSection('root');
                        }
                    }}
                    className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight">
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
                                className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary/20 hover:shadow-md transition-all group"
                            >
                                <span className="font-medium text-sm text-gray-800">{section.label}</span>
                                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-primary transition-colors" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        {activeSection === 'integrations' && (
                            <div className="p-4">
                                <IntegrationsPage />
                            </div>
                        )}

                        {activeSection === 'model' && (
                            <div className="p-5 space-y-6">
                                <div className="space-y-1 w-full">
                                    <h2 className="text-sm font-semibold text-gray-900">Bring Your Own Key</h2>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Extenda runs securely on your own API keys. Keys are saved locally to your device and directly passed to the vendor. We do not store them on our databases.
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
                                    <label className="block text-sm font-medium text-gray-800">
                                        Response Target Stylings
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['professional', 'casual', 'concise', 'detailed'].map((style) => (
                                            <button
                                                key={style}
                                                onClick={() => setPromptStyle(style)}
                                                className={`px-4 py-3 rounded-xl border text-sm font-medium capitalize transition-all ${
                                                    promptStyle === style 
                                                        ? 'border-primary bg-primary text-white shadow-md' 
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-primary/30'
                                                }`}
                                            >
                                                {style}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-gray-800">
                                        Global System Execution Prompt
                                    </label>
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="E.g. Always write code in Python. Always respond natively in Spanish. Do not use emojis."
                                        rows={6}
                                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none shadow-sm placeholder:text-gray-400"
                                    />
                                    <p className="text-xs text-gray-500">Injected into the orchestrator context block for every prompt.</p>
                                </div>
                            </div>
                        )}

                        {activeSection === 'general' && (
                            <div className="p-5 space-y-2">
                                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">Auto-execute Workflows</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Run generated code actions instantly
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setAutoExecute(!autoExecute)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoExecute ? 'bg-primary' : 'bg-gray-200'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoExecute ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">Push Notifications</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Alert me when tasks complete in background
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setNotifications(!notifications)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications ? 'bg-primary' : 'bg-gray-200'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Save Button */}
                        {activeSection !== 'integrations' && (
                            <div className="p-5 mt-auto">
                                <button
                                    onClick={handleSave}
                                    className={`w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-md font-semibold text-sm transition-all focus:outline-none focus:ring-4 focus:ring-primary/20 ${saved
                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                        : 'bg-gray-900 text-white hover:bg-black'
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
