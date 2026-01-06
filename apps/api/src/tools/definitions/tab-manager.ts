import { ToolDefinition } from '@extenda/shared';

export const TabManager: ToolDefinition = {
    name: 'TabManager',
    description: 'Manage browser tabs: open, switch, close, and list tabs.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['open', 'switch', 'close', 'list'],
                description: 'The action to perform on the tabs.'
            },
            url: {
                type: 'string',
                description: 'The URL to open (required for "open" action).'
            },
            tabId: {
                type: 'number',
                description: 'The ID of the tab to switch to or close.'
            }
        },
        required: ['action']
    }
};
