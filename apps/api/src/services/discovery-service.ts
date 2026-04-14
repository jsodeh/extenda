import { adapterRegistry } from '../adapters/index.js';
import { toolRegistry } from '../tools/registry.js';
import { oauthManager } from './oauth-manager.js';
import { PreferencesService } from './preferences-service.js';

export interface DiscoveryManifest {
    adapters: Array<{
        id: string;
        name: string;
        description: string;
        version: string;
        isConnected: boolean;
        actions: Array<{
            id: string;
            name: string;
            description: string;
            permission: string;
        }>;
    }>;
    tools: Array<{
        name: string;
        description: string;
        parameters: any;
    }>;
}

export class DiscoveryService {
    /**
     * Generates a full manifest of all registered adapters and tools,
     * decorated with real-time connectivity and permission status for a specific user.
     */
    static async getStatusManifest(userId: string): Promise<DiscoveryManifest> {
        const connectedProviders = await oauthManager.getConnectedProviders(userId);
        const prefs = await PreferencesService.get(userId);
        const toolPermissions = prefs?.toolPermissions || {};

        const adapters = adapterRegistry.getAll().map(adapter => {
            const id = adapter.name.toLowerCase().replace('adapter', '');
            
            // Map actions and inject current permission level
            const actions = (adapter.actions || []).map(action => ({
                id: action.name,
                name: action.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                description: action.description,
                permission: toolPermissions[action.name] || (action as any).defaultPermission || 'allowed'
            }));

            // Determine connectivity
            // We need a subtle mapping: Gmail/Calendar/Drive use 'google' provider
            const providerMap: Record<string, string> = {
                'gmail': 'google',
                'google-drive': 'google',
                'google-calendar': 'google',
                'google-forms': 'google'
            };
            
            const providerId = providerMap[id] || id;
            const isConnected = (adapter as any).type === 'built-in' || connectedProviders.includes(providerId);

            return {
                id,
                name: adapter.name,
                description: adapter.description,
                version: (adapter as any).version || '1.0.0',
                isConnected,
                actions
            };
        });

        const tools = toolRegistry.getAll().map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));

        return {
            adapters,
            tools
        };
    }

    /**
     * Static manifest without user context (Legacy support)
     */
    static getManifest(): any {
        return {
            adapters: adapterRegistry.getAll().map(a => ({ id: a.name.toLowerCase(), name: a.name })),
            tools: toolRegistry.getAll().map(t => ({ name: t.name }))
        };
    }
}
