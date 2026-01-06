import axios from 'axios';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        name: 'get_event_types',
        description: 'Get available event types',
        parameters: {
            type: 'object',
            properties: {
                user_uri: { type: 'string', description: 'User URI (optional)' }
            }
        }
    },
    {
        name: 'list_events',
        description: 'List scheduled events',
        parameters: {
            type: 'object',
            properties: {
                user: { type: 'string', description: 'User URI' },
                count: { type: 'number', description: 'Number of events to return' }
            }
        }
    }
];

export class CalendlyAdapter extends BaseAdapter {
    name = 'CalendlyAdapter';
    description = 'Manage Calendly scheduling';
    version = '1.0.0';
    scopes = [];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const token = process.env.CALENDLY_API_TOKEN;
        const api = axios.create({
            baseURL: 'https://api.calendly.com',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        switch (actionName) {
            case 'get_event_types':
                const res = await api.get('/event_types', {
                    params: params.user_uri ? { user: params.user_uri } : {}
                });
                return res.data.collection;

            case 'list_events':
                const eventsRes = await api.get('/scheduled_events', {
                    params: {
                        user: params.user,
                        count: params.count || 20
                    }
                });
                return eventsRes.data.collection;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
