import { Agent, ToolDefinition } from './types.js';
import { Adapter } from '@extenda/shared';

export class SpecializedAgent implements Agent {
    name: string;
    description: string;
    systemPrompt: string;
    tools: ToolDefinition[];

    constructor(name: string, description: string, systemPrompt: string, tools: ToolDefinition[]) {
        this.name = name;
        this.description = description;
        this.systemPrompt = systemPrompt;
        this.tools = tools;
    }

    static fromAdapter(adapter: Adapter, customPrompt?: string): SpecializedAgent {
        const tools: ToolDefinition[] = adapter.actions.map(action => ({
            name: `${adapter.name}_${action.name}`,
            description: action.description,
            parameters: action.parameters,
            execute: (params: any, context: any) => adapter.execute(action.name, params, context)
        }));

        const systemPrompt = `You are a specialized agent for ${adapter.name}.
Your goal is to handle tasks related to ${adapter.name} efficiently.
${customPrompt ? `\n\nCustom Instructions:\n${customPrompt}` : ''}`;

        return new SpecializedAgent(
            `${adapter.name} Agent`,
            `Specialized agent for handling ${adapter.name} tasks such as ${adapter.actions.map(a => a.name).join(', ')}.`,
            systemPrompt,
            tools
        );
    }
}
