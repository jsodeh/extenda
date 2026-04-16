import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    { id: 'notify', name: 'Send Notifications', description: 'Show desktop alerts when tasks are done.', parameters: { type: 'object', properties: {} } },
    { id: 'get_current_time', name: 'Check Time', description: 'Access current date and time information.', parameters: { type: 'object', properties: {} } }
];

export class SystemUtilsAdapter extends BaseAdapter {
    id = 'system_utils';
    type = 'built-in' as const;
    name = 'System Utilities';
    description = 'General system helper functions.';
    version = '1.0.0';
    scopes = [];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        return { success: true, message: `Action ${actionName} routed to system tools.` };
    }
}
