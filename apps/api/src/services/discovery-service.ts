import { adapterRegistry } from '../adapters/index.js';
import { toolRegistry } from '../tools/registry.js';
import { SpecializedAgent } from '../agents/specialized-agent.js';

export interface DiscoveryManifest {
    adapters: Array<{
        id: string;
        name: string;
        description: string;
        version: string;
        actions: Array<{
            name: string;
            description: string;
            parameters: any;
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
     * Generates a full manifest of all registered adapters and tools.
     * This can be used by the UI to dynamically build the Integrations page.
     */
    static getManifest(): DiscoveryManifest {
        const adapters = adapterRegistry.getAll().map(adapter => ({
            id: adapter.name.toLowerCase().replace('adapter', ''),
            name: adapter.name,
            description: adapter.description,
            version: (adapter as any).version || '1.0.0',
            actions: adapter.actions || []
        }));

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
}
