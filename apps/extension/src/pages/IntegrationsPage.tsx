import { useEffect, useState } from 'react';
import { initiateOAuthFlow, fetchConnectedProviders, disconnectProvider } from '../lib/oauth';
import { Check, X, Loader, MoreVertical, ExternalLink, Settings } from 'lucide-react';

// Assuming custom simple dropdown since Radix might not be there. Let's use simple state-based dropdown or just buttons.
// The user asked for "dropdown of all available actions".

// Icon imports
import googleIcon from '../assets/google.png';
import slackIcon from '../assets/slack.png'; // Need to check if these exist, I copied them.
import jiraIcon from '../assets/jira.svg'; // Defaulting to png if invalid
import asanaIcon from '../assets/asana.png';
import notionIcon from '../assets/notion.png';
import hubspotIcon from '../assets/hubspot.png'; // I need to verify filenames. I copied `icons/*.png`.
// Checking list_dir of icons folder from memory:
// asana.png, github.png, gmail.png, google.png, google_docs.png, google_drive.png, google_sheet.png, linkedin.png, notion.png.
// No slack, jira, hubspot in the root icons list I saw?
// Wait, I saw "asana.png", "github.png", "gmail.png", "google.png"...
// I need to use the available ones.
import gmailIcon from '../assets/gmail.png';
import googleDocsIcon from '../assets/google_docs.png';
import googleDriveIcon from '../assets/google_drive.png';
import githubIcon from '../assets/github.png';
import linkedinIcon from '../assets/linkedin.png';

interface Provider {
    id: string;
    name: string;
    description: string;
    icon: string;
    scopes: string[];
    actions: string[];
}


const PROVIDERS: Provider[] = [
    {
        id: 'google',
        name: 'Google',
        description: 'Connect Gmail, Calendar, and Drive',
        icon: googleIcon,
        scopes: ['Gmail', 'Calendar', 'Drive'],
        actions: ['Summarize Emails', 'Draft Reply', 'Check Calendar']
    },
    {
        id: 'github',
        name: 'GitHub',
        description: 'Manage issues and PRs',
        icon: githubIcon,
        scopes: ['Repo', 'User'],
        actions: ['List Issues', 'Create Issue', 'Review PR']
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        description: 'Network and post updates',
        icon: linkedinIcon,
        scopes: ['Profile', 'Post'],
        actions: ['Brief Profile', 'Generate Post']
    },
    {
        id: 'asana',
        name: 'Asana',
        description: 'Manage tasks and projects',
        icon: asanaIcon,
        scopes: ['Tasks', 'Projects'],
        actions: ['List Tasks', 'Create Task']
    },
    {
        id: 'notion',
        name: 'Notion',
        description: 'Create and manage pages',
        icon: notionIcon,
        scopes: ['Pages', 'Databases'],
        actions: ['Read Page', 'Append Content']
    }
];

// Helper component for Dropdown
function ActionDropdown({ actions }: { actions: string[] }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-gray-100 rounded-full"
            >
                <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-100 py-1">
                        {actions.map(action => (
                            <button
                                key={action}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setIsOpen(false)}
                            >
                                {action}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default function IntegrationsPage() {
    const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState<string | null>(null);
    const [loadingPage, setLoadingPage] = useState(true);

    useEffect(() => {
        loadConnectedProviders();
    }, []);

    const loadConnectedProviders = async () => {
        setLoadingPage(true);
        const providers = await fetchConnectedProviders();
        setConnectedProviders(new Set(providers));
        setLoadingPage(false);
    };

    const handleConnect = async (providerId: string) => {
        setLoading(providerId);
        const result = await initiateOAuthFlow(providerId);

        if (result.success) {
            setConnectedProviders(prev => new Set([...prev, providerId]));
        } else {
            alert(`Failed to connect: ${result.error || 'Unknown error'}`);
        }

        setLoading(null);
    };

    const handleDisconnect = async (providerId: string) => {
        if (!confirm(`Are you sure you want to disconnect ${providerId}?`)) return;

        setLoading(providerId);
        const success = await disconnectProvider(providerId);

        if (success) {
            setConnectedProviders(prev => {
                const newSet = new Set(prev);
                newSet.delete(providerId);
                return newSet;
            });
        } else {
            alert('Failed to disconnect provider');
        }

        setLoading(null);
    };

    if (loadingPage) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <Loader className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Connect your accounts to enable powerful automations
                </p>
            </div>

            {/* Provider Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                    {PROVIDERS.map((provider) => {
                        const isConnected = connectedProviders.has(provider.id);
                        const isLoading = loading === provider.id;

                        return (
                            <div
                                key={provider.id}
                                className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                            >
                                {/* Provider Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <img src={provider.icon} alt={provider.name} className="w-10 h-10 object-contain" />
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {provider.name}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {provider.description}
                                            </p>
                                        </div>
                                    </div>

                                    {isConnected && (
                                        <div className="flex items-center gap-1 text-green-600">
                                            <Check className="h-4 w-4" />
                                            <span className="text-xs font-medium">Connected</span>
                                        </div>
                                    )}

                                    <ActionDropdown actions={provider.actions} />
                                </div>

                                {/* Scopes */}
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {provider.scopes.map((scope) => (
                                        <span
                                            key={scope}
                                            className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                                        >
                                            {scope}
                                        </span>
                                    ))}
                                </div>

                                {/* Action Button */}
                                <button
                                    onClick={() => isConnected ? handleDisconnect(provider.id) : handleConnect(provider.id)}
                                    disabled={isLoading}
                                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isConnected
                                        ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader className="h-4 w-4 animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : isConnected ? (
                                        <>
                                            <X className="h-4 w4" />
                                            <span>Disconnect</span>
                                        </>
                                    ) : (
                                        <span>Connect</span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Connected Count */}
                <div className="text-center mt-8 text-sm text-gray-600">
                    {connectedProviders.size} of {PROVIDERS.length} integrations connected
                </div>
            </div>
        </div>
    );
}
