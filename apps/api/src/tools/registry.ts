import { Tool } from '@extenda/shared';
import { TabManager } from './definitions/tab-manager.js';
import { DOMReaderTool, GmailScraperTool } from './definitions/content-tools.js';
import { FormFillerTool, NotifierTool } from './definitions/base-tools.js';
import { AIProcessorTool } from './ai-processor.js';

export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    register(tool: Tool) {
        if (this.tools.has(tool.name)) {
            console.warn(`Tool ${tool.name} is already registered. Overwriting.`);
        }
        this.tools.set(tool.name, tool);
        console.log(`Registered tool: ${tool.name}`);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    getToolsContext(): string {
        return this.getAll().map(t =>
            `- ${t.name}: ${t.description} (Params: ${JSON.stringify(t.parameters)})`
        ).join('\n');
    }
}

export const toolRegistry = new ToolRegistry();

// Register base tools
toolRegistry.register(TabManager);
toolRegistry.register(DOMReaderTool);
toolRegistry.register(GmailScraperTool);
toolRegistry.register(FormFillerTool);
toolRegistry.register(NotifierTool);
toolRegistry.register(AIProcessorTool);
