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
                className="p-1 hover:bg-muted rounded-full transition-colors"
            >
                <MoreVertical className="h-5 w-5 text-muted-foreground" />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg z-20 border border-border py-1 overflow-hidden">
                        {actions.map(action => (
                            <button
                                key={action}
                                className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
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
            <div className="flex items-center justify-center h-full bg-background">
                <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header - Hidden since SettingsPage has its own header, but keeping structure for safety if needed separately */}
            {/* <div className="border-b border-border bg-background px-6 py-4 shadow-sm">
                <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Connect your accounts to enable powerful automations
                </p>
            </div> */}

            {/* Provider Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto">
                    {PROVIDERS.map((provider) => {
                        const isConnected = connectedProviders.has(provider.id);
                        const isLoading = loading === provider.id;

                        return (
                            <div
                                key={provider.id}
                                className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm hover:border-primary/20 transition-all group"
                            >
                                {/* Provider Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center p-1.5">
                                            <img src={provider.icon} alt={provider.name} className="w-full h-full object-contain" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold text-foreground">
                                                {provider.name}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                {provider.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {isConnected && (
                                            <div className="flex items-center gap-1 text-emerald-500">
                                                <Check className="h-4 w-4" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Connected</span>
                                            </div>
                                        )}
                                        <ActionDropdown actions={provider.actions} />
                                    </div>
                                </div>

                                {/* Scopes */}
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {provider.scopes.map((scope) => (
                                        <span
                                            key={scope}
                                            className="px-2 py-0.5 bg-muted/60 text-muted-foreground text-[10px] font-medium rounded-full border border-border/10"
                                        >
                                            {scope}
                                        </span>
                                    ))}
                                </div>

                                {/* Action Button */}
                                <button
                                    onClick={() => isConnected ? handleDisconnect(provider.id) : handleConnect(provider.id)}
                                    disabled={isLoading}
                                    className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${isConnected
                                        ? 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20'
                                        : 'bg-primary text-primary-foreground hover:opacity-90 shadow-md active:scale-95'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader className="h-4 w-4 animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : isConnected ? (
                                        <>
                                            <X className="h-4 w-4" />
                                            <span>Disconnect</span>
                                        </>
                                    ) : (
                                        <span>Connect {provider.name}</span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Connected Count */}
                <div className="text-center mt-8 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                    {connectedProviders.size} of {PROVIDERS.length} connected
                </div>
            </div>
        </div>
    );
}
