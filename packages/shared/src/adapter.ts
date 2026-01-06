import { ToolDefinition } from './types';

export interface AdapterAction {
    name: string;
    description: string;
    parameters: any; // JSON Schema
}

export interface Adapter {
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
