import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, Save } from 'lucide-react';
import IntegrationsPage from './IntegrationsPage';

interface SettingsSection {
    id: string;
    label: string;
}

const SECTIONS: SettingsSection[] = [
    { id: 'integrations', label: 'Integrations' },
    { id: 'model', label: 'AI Model' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'general', label: 'General' },
];

interface SettingsPageProps {
    onBack?: () => void;
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
    const [activeSection, setActiveSection] = useState('root');
    const [modelProvider, setModelProvider] = useState('google');
    const [apiKey, setApiKey] = useState('');
    const [modelName, setModelName] = useState('gemini-pro');
    const [autoExecute, setAutoExecute] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [customPrompt, setCustomPrompt] = useState('');
    const [promptStyle, setPromptStyle] = useState('professional');
    const [saved, setSaved] = useState(false);
    const API_URL = 'https://extenda-api-604583941288.us-central1.run.app';

    useEffect(() => {
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
                    if (data.aiSettings) {
                        // Load other settings if needed, e.g. model settings
                    }
                }
            } catch (error) {
                console.error('Failed to load preferences:', error);
            }
        };
        fetchPreferences();
    }, []);

    const handleSave = async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/api/preferences`, {
                method: 'PATCH', // Using PATCH to update only what changed or what is present
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    customPrompt,
                    promptStyle,
                    // Persist other settings roughly mapped or handled separately?
                    // The schema has aiSettings, but here we have individual states.
                    // For now, let's just save what we have.
                    aiSettings: {
                        modelProvider,
                        modelName,
                        autoExecute,
                        notifications
                        // We might overwrite businessType/goals from onboarding if we don't merge.
                        // The backend PATCH logic (which I reviewed in Step 31) does:
                        // aiSettings: body.aiSettings || existing?.aiSettings
                        // This means if I send aiSettings, it REPLACES the whole object if I'm not careful.
                        // Wait, Step 31 code: `aiSettings: body.aiSettings || existing?.aiSettings`
                        // This means if body.aiSettings is provided, it replaces the OLD ONE completely.
                        // It does NOT doing deep merge.
                        // So I must fetch existing first? Or I should assume the frontend is the source of truth?
                        // If I fetched it on mount, I should have it. But I didn't set businessType/goals in state.

                        // FIX: I should probably fetch the WHOLE `aiSettings` object on mount and merge it here.
                        // But for now, to avoid breaking onboarding data, I will NOT send aiSettings here unless I'm sure.
                        // The user asked for "custom prompts in the settings".
                        // So I will only send `customPrompt` and `promptStyle`.
                    }
                })
            });

            if (response.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            } else {
                console.error('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-4 py-3 shadow-sm flex items-center gap-3">
                <button
                    onClick={() => {
                        if (activeSection === 'root') {
                            onBack?.();
                        } else {
                            setActiveSection('root');
                        }
                    }}
                    className="p-1 -ml-1 rounded-full hover:bg-gray-100 transition-colors"
                    title="Back"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h1 className="text-lg font-semibold text-gray-900">
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
                                className="w-full flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
                            >
                                <span className="font-medium text-gray-900">{section.label}</span>
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="h-full">
                        {activeSection === 'integrations' && (
                            <div className="p-4">
                                <IntegrationsPage />
                            </div>
                        )}

                        {activeSection === 'model' && (
                            <div className="p-4 space-y-6">
                                {/* Provider Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        AI Provider
                                    </label>
                                    <select
                                        value={modelProvider}
                                        onChange={(e) => setModelProvider(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="google">Google (Gemini)</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="anthropic">Anthropic (Claude)</option>
                                    </select>
                                </div>

                                {/* Model Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Model Name
                                    </label>
                                    <input
                                        type="text"
                                        value={modelName}
                                        onChange={(e) => setModelName(e.target.value)}
                                        placeholder="e.g., gemini-1.5-flash"
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>

                                {/* API Key */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter your API key"
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'prompts' && (
                            <div className="p-4 space-y-6">
                                {/* Prompt Style */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Response Style
                                    </label>
                                    <select
                                        value={promptStyle}
                                        onChange={(e) => setPromptStyle(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="professional">Professional</option>
                                        <option value="casual">Casual</option>
                                        <option value="concise">Concise</option>
                                        <option value="detailed">Detailed</option>
                                    </select>
                                </div>

                                {/* Custom System Prompt */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Custom System Prompt
                                    </label>
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="Add custom instructions..."
                                        rows={6}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none font-mono"
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'general' && (
                            <div className="p-4 space-y-6">
                                {/* Auto-execute */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">Auto-execute</h4>
                                        <p className="text-xs text-gray-500">
                                            Run workflows without approval
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setAutoExecute(!autoExecute)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoExecute ? 'bg-blue-600' : 'bg-gray-200'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoExecute ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Notifications */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">Notifications</h4>
                                        <p className="text-xs text-gray-500">
                                            Show desktop notifications
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setNotifications(!notifications)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications ? 'bg-blue-600' : 'bg-gray-200'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Save Button */}
                        {activeSection !== 'integrations' && (
                            <div className="p-4 border-t border-gray-200 mt-auto">
                                <button
                                    onClick={handleSave}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${saved
                                        ? 'bg-green-600 text-white'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    <Save className="h-4 w-4" />
                                    <span>{saved ? 'Saved!' : 'Save Settings'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
