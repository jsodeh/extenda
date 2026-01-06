import { ToolDefinition } from './types';
export interface AdapterAction {
    name: string;
    description: string;
    parameters: any;
}
export interface Adapter {
    name: string;
    description: string;
    version: string;
    scopes: string[];
    actions: AdapterAction[];
    execute(actionName: string, params: any, context: any): Promise<any>;
    toTools(): ToolDefinition[];
}
export interface AdapterConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    [key: string]: any;
}
