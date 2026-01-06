export interface ToolDefinition {
    name: string;
    description: string;
    parameters: any;
    execute: (params: any, context: any) => Promise<any>;
}

export interface Agent {
    name: string;
    description: string;
    systemPrompt: string;
    tools: ToolDefinition[];
    plan?: (intent: string, history: string[], context: any) => Promise<any>;
}
