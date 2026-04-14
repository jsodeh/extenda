import { useEffect, useState } from 'react';
import { initiateOAuthFlow, fetchConnectedProviders, disconnectProvider } from '../lib/oauth';
import { Check, X, Loader, Shield, Lock, Eye, AlertTriangle, Settings, ChevronRight } from 'lucide-react';
import { ADAPTERS, Adapter, ToolAction, PermissionLevel } from '../lib/tools/adapters';
import { getApiUrl } from '../lib/api';

// --- Components ---

interface ActionItemProps {
    action: ToolAction;
    permission: PermissionLevel;
    onChange: (level: PermissionLevel) => void;
}

function ActionItem({ action, permission, onChange }: ActionItemProps) {
    return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40 mb-2">
            <div className="flex-1 mr-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{action.name}</span>
                    {permission === 'approval_required' && (
                        <div className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Review Required</span>
                        </div>
                    )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{action.description}</p>
            </div>
            
            <select 
                value={permission}
                onChange={(e) => onChange(e.target.value as PermissionLevel)}
                className="bg-card text-foreground text-xs font-medium py-1 px-2 rounded-lg border border-border shadow-sm focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
            >
                <option value="allowed">Allowed</option>
                <option value="approval_required">Ask (Approval)</option>
                <option value="disabled">Disabled</option>
            </select>
        </div>
    );
}

// --- Main Page ---

export default function IntegrationsPage() {
    const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
    const [toolPermissions, setToolPermissions] = useState<Record<string, PermissionLevel>>({});
    const [loading, setLoading] = useState<string | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [selectedAdapter, setSelectedAdapter] = useState<Adapter | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            setLoadingSettings(true);
            const { accessToken } = await chrome.storage.local.get(['accessToken']);
            setAccessToken(accessToken);
            
            await loadPreferences(accessToken);
            await loadConnectedProviders();
            setLoadingSettings(false);
        };
        init();
    }, []);

    const loadPreferences = async (token: string | null) => {
        try {
            // 1. Try local storage first
            const local = await chrome.storage.local.get(['tool_permissions']);
            if (local.tool_permissions) {
                setToolPermissions(local.tool_permissions);
            }

            // 2. Fetch from cloud
            if (token) {
                const API_URL = await getApiUrl();
                const response = await fetch(`${API_URL}/api/preferences`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.toolPermissions) {
                        setToolPermissions(data.toolPermissions);
                        chrome.storage.local.set({ tool_permissions: data.toolPermissions });
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load preferences:', err);
        }
    };

    const loadConnectedProviders = async () => {
        const providers = await fetchConnectedProviders();
        setConnectedProviders(new Set(providers));
    };

    const handlePermissionChange = async (actionId: string, level: PermissionLevel) => {
        const updated = { ...toolPermissions, [actionId]: level };
        setToolPermissions(updated);
        
        // Save locally for instant reaction
        await chrome.storage.local.set({ tool_permissions: updated });

        // Sync to backend (Fire & Forget/Optimistic)
        if (accessToken) {
            try {
                const API_URL = await getApiUrl();
                fetch(`${API_URL}/api/preferences`, {
                    method: 'PATCH',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({ toolPermissions: updated })
                });
            } catch (err) {
                console.warn('Silent sync failure:', err);
            }
        }
    };

    const handleSyncReset = async () => {
        if (!confirm('Revert all tool permissions to defaults?')) return;
        const defaults: Record<string, PermissionLevel> = {};
        ADAPTERS.forEach(a => a.actions.forEach(act => defaults[act.id] = act.defaultPermission));
        setToolPermissions(defaults);
        await chrome.storage.local.set({ tool_permissions: defaults });
        // Backend sync...
    };

    const handleConnect = async (providerId: string) => {
        setLoading(providerId);
        const result = await initiateOAuthFlow(providerId);
        if (result.success) {
            setConnectedProviders(prev => new Set([...prev, providerId]));
            await loadConnectedProviders();
        } else {
            alert(`Connect failed: ${result.error}`);
        }
        setLoading(null);
    };

    const handleDisconnect = async (providerId: string) => {
        if (!confirm(`Disconnect ${providerId}?`)) return;
        setLoading(providerId);
        const success = await disconnectProvider(providerId);
        if (success) {
            setConnectedProviders(prev => {
                const n = new Set(prev);
                n.delete(providerId);
                return n;
            });
        }
        setLoading(null);
    };

    if (loadingSettings) {
        return (
            <div className="flex items-center justify-center h-full bg-background">
                <Loader className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
            {/* Minimal Header */}
            <div className="px-6 py-3 border-b border-border/50 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold text-foreground">Integrations</h2>
                    <p className="text-[10px] text-muted-foreground">Configure AI tool access</p>
                </div>
                <button 
                   onClick={handleSyncReset}
                   className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <Settings className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Compact Grid */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                <div className="grid grid-cols-2 gap-3">
                    {ADAPTERS.map((adapter) => {
                        const isConnected = adapter.type === 'built-in' || (adapter.provider && connectedProviders.has(adapter.provider));
                        
                        return (
                            <button
                                key={adapter.id}
                                onClick={() => setSelectedAdapter(adapter)}
                                className="flex flex-col aspect-square rounded-2xl border border-border bg-card p-3 text-left hover:border-primary/40 hover:shadow-md transition-all group relative overflow-hidden active:scale-95"
                            >
                                <div className="mb-auto">
                                   <div className={`w-8 h-8 rounded-xl ${isConnected ? 'bg-primary/10' : 'bg-muted'} flex items-center justify-center p-1.5 transition-colors`}>
                                        {adapter.icon ? (
                                            <img src={adapter.icon} alt={adapter.name} className={`w-full h-full object-contain ${isConnected ? '' : 'grayscale opacity-50'}`} />
                                        ) : (
                                            <Shield className={`w-full h-full ${isConnected ? 'text-primary' : 'text-muted-foreground'}`} />
                                        )}
                                   </div>
                                </div>
                                
                                <div>
                                    <h4 className="text-[11px] font-bold text-foreground truncate">{adapter.name}</h4>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground/30'}`} />
                                        <span className="text-[9px] text-muted-foreground font-medium">{isConnected ? 'Enabled' : 'Disabled'}</span>
                                    </div>
                                </div>

                                <ChevronRight className="absolute bottom-3 right-3 w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Modal Overlay */}
            {selectedAdapter && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div 
                        className="absolute inset-0" 
                        onClick={() => setSelectedAdapter(null)} 
                    />
                    
                    <div className="relative bg-card border-t border-border rounded-t-3xl shadow-2xl w-full max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-400">
                        {/* Modal Header */}
                        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center p-2">
                                    {selectedAdapter.icon ? (
                                        <img src={selectedAdapter.icon} alt={selectedAdapter.name} className="w-full h-full object-contain" />
                                    ) : (
                                        <Shield className="w-full h-full text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-foreground leading-tight">{selectedAdapter.name}</h3>
                                    <p className="text-xs text-muted-foreground pr-4 mt-0.5">{selectedAdapter.description}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedAdapter(null)}
                                className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Connection Controls (for OAuth) */}
                        {selectedAdapter.type === 'oauth' && selectedAdapter.provider && (
                            <div className="px-6 mb-4">
                                {connectedProviders.has(selectedAdapter.provider) ? (
                                    <button 
                                        onClick={() => handleDisconnect(selectedAdapter.provider!)}
                                        disabled={loading === selectedAdapter.provider}
                                        className="w-full py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center gap-2 border border-destructive/20 hover:bg-destructive hover:text-white transition-all"
                                    >
                                        {loading === selectedAdapter.provider ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                                        Disconnect Account
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleConnect(selectedAdapter.provider!)}
                                        disabled={loading === selectedAdapter.provider}
                                        className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        {loading === selectedAdapter.provider ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        Connect {selectedAdapter.name}
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="h-px bg-border/50 mx-6 mb-4" />

                        {/* Actions Scrollview */}
                        <div className="flex-1 overflow-y-auto px-6 pb-8">
                            <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3" />
                                Granular Permissions
                            </h5>
                            
                            {selectedAdapter.actions.map(action => (
                                <ActionItem 
                                    key={action.id}
                                    action={action}
                                    permission={toolPermissions[action.id] || action.defaultPermission}
                                    onChange={(level) => handlePermissionChange(action.id, level)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
