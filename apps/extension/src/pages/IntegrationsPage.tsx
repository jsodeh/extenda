import { useEffect, useState } from 'react';
import { initiateOAuthFlow, fetchConnectedProviders, disconnectProvider } from '../lib/oauth';
import { Check, X, Loader, Shield, Lock, Eye, AlertTriangle, Settings, ChevronRight, RotateCcw } from 'lucide-react';
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
    const [adapters, setAdapters] = useState<Adapter[]>([]);
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
            
            await fetchDiscoveryStatus(accessToken);
            setLoadingSettings(false);
        };
        init();
    }, []);

    const fetchDiscoveryStatus = async (token: string | null) => {
        try {
            if (!token) {
                setAdapters(ADAPTERS);
                return;
            }
            const API_URL = await getApiUrl();
            const response = await fetch(`${API_URL}/api/preferences/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const manifest = await response.json();
                
                // Map the dynamic manifest to the UI Adapter format
                const mappedAdapters: Adapter[] = (manifest.adapters || []).map((a: any) => {
                    // Find static metadata for icons/providers
                    const staticMeta = ADAPTERS.find(s => s.id === a.id);
                    return {
                        ...a,
                        type: staticMeta?.type || 'oauth',
                        provider: staticMeta?.provider,
                        icon: staticMeta?.icon,
                    };
                });

                if (mappedAdapters.length > 0) {
                    setAdapters(mappedAdapters);

                    const perms: Record<string, PermissionLevel> = {};
                    mappedAdapters.forEach(a => {
                        a.actions.forEach(act => {
                            perms[act.id] = act.permission as PermissionLevel;
                        });
                    });
                    setToolPermissions(perms);
                    
                    const providers = new Set<string>();
                    mappedAdapters.forEach(a => {
                        if (a.isConnected && a.provider) providers.add(a.provider);
                    });
                    setConnectedProviders(providers);
                } else {
                    setAdapters(ADAPTERS);
                }
            } else {
                console.warn('Discovery API returned error, falling back to static list');
                setAdapters(ADAPTERS);
            }
        } catch (err) {
            console.error('Failed to fetch discovery status:', err);
            setAdapters(ADAPTERS);
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
        adapters.forEach(a => a.actions.forEach(act => defaults[act.id] = (act as any).defaultPermission || 'allowed'));
        setToolPermissions(defaults);
        await chrome.storage.local.set({ tool_permissions: defaults });
    };

    const handleConnect = async (providerId: string) => {
        setLoading(providerId);
        const result = await initiateOAuthFlow(providerId);
        if (result.success) {
            await fetchDiscoveryStatus(accessToken);
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
            await fetchDiscoveryStatus(accessToken);
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
                   className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted text-[10px] font-bold text-muted-foreground transition-all active:scale-95 border border-border/40"
                   title="Reset all permissions to defaults"
                >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                </button>
            </div>

            {/* Compact Grid */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                <div className="grid grid-cols-2 gap-2.5">
                    {adapters.map((adapter) => {
                        const isConnected = adapter.isConnected;
                        
                        return (
                            <button
                                key={adapter.id}
                                onClick={() => setSelectedAdapter(adapter)}
                                className="flex flex-col aspect-square rounded-xl border border-border bg-card p-2.5 text-left hover:border-primary/40 hover:shadow-sm transition-all group relative overflow-hidden active:scale-95"
                            >
                                <div className="mb-auto flex items-start justify-between">
                                   <div className={`w-7 h-7 rounded-lg ${isConnected ? 'bg-primary/10' : 'bg-muted'} flex items-center justify-center p-1.5 transition-colors`}>
                                        {adapter.icon ? (
                                            <img src={adapter.icon} alt={adapter.name} className={`w-full h-full object-contain ${isConnected ? '' : 'grayscale opacity-50'}`} />
                                        ) : (
                                            <Shield className={`w-full h-full ${isConnected ? 'text-primary' : 'text-muted-foreground'}`} />
                                        )}
                                   </div>
                                   <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground/30'}`} />
                                </div>
                                
                                <div>
                                    <h4 className="text-[10px] font-bold text-foreground truncate pr-2 leading-tight">{adapter.name}</h4>
                                    <p className="text-[8px] text-muted-foreground font-medium truncate mt-0.5">{adapter.actions.length} Actions</p>
                                </div>
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
