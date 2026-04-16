import { ToolDefinition } from './types';

export interface AdapterAction {
    id: string;          // Unique action identifier for tracking
    name: string;
    description: string;
    parameters: any; // JSON Schema
}

export interface Adapter {
    id: string;                        // Unique adapter identifier (e.g. 'gmail', 'google_drive')
    type: 'oauth' | 'built-in';       // Authentication type
    provider?: string;                 // OAuth provider key (e.g. 'google', 'slack')
    name: string;
    description: string;
    version: string;
    scopes: string[]; // OAuth scopes required
    actions: AdapterAction[];

    // Execute a specific action
    execute(actionName: string, params: any, context: any): Promise<any>;

    // Convert adapter actions to tool definitions for the agent
    toTools(): ToolDefinition[];
}

export interface AdapterConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    [key: string]: any;
}
