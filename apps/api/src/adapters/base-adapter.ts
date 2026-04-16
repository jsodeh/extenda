import { Adapter, AdapterAction, ToolDefinition } from '@extenda/shared';

export abstract class BaseAdapter implements Adapter {
    abstract id: string;
    abstract type: 'built-in' | 'oauth';
    provider?: string;
    abstract name: string;
    abstract description: string;
    abstract version: string;
    abstract scopes: string[];
    abstract actions: AdapterAction[];

    abstract execute(actionName: string, params: any, context: any): Promise<any>;

    toTools(): ToolDefinition[] {
        return this.actions.map(action => ({
            name: `${this.name}_${action.name}`, // e.g., GmailWrapper_send_email
            description: action.description,
            parameters: action.parameters
        }));
    }
}
