import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';
import { enqueue } from '../services/scheduler.js';

export class PlanningAdapter extends BaseAdapter {
    id = 'planning';
    name = 'PlanningAdapter';
    type = 'built-in' as const;
    version = '1';
    scopes = [];
    description = 'Schedule approved server-side reminders and calendar work';
    actions: AdapterAction[] = [
        {
            id: 'schedule',
            name: 'schedule',
            description: 'Schedule a reminder or calendar event creation after review',
            parameters: {
                type: 'object',
                required: ['at', 'timezone', 'action', 'payload'],
                properties: {
                    at: { type: 'string', description: 'Execution time with UTC offset' },
                    timezone: { type: 'string', description: 'IANA timezone' },
                    action: { type: 'string', enum: ['reminder', 'calendar'] },
                    recurrence: { type: 'string', enum: ['once', 'daily', 'weekly'] },
                    payload: {
                        type: 'object',
                        description: 'Reminder {message} or Google Calendar create_event parameters'
                    }
                }
            }
        }
    ];
    execute(action: string, params: any, context: any) {
        if (action !== 'schedule') throw new Error('Unknown planning action');
        return enqueue(context.userId, params, context.idempotencyKey, context.approval);
    }
}
