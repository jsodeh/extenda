import axios from 'axios';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_message',
        name: 'create_message',
        description: 'Create a social media message via Hootsuite',
        parameters: {
            type: 'object',
            required: ['text', 'socialProfileIds'],
            properties: {
                text: { type: 'string', description: 'Message text' },
                socialProfileIds: { type: 'array', items: { type: 'string' }, description: 'Social profile IDs' },
                scheduledSendTime: { type: 'string', description: 'ISO 8601 timestamp for scheduling' }
            }
        }
    }
];

export class HootsuiteAdapter extends BaseAdapter {
    id = 'hootsuite';
    type = 'oauth' as const;
    provider = 'hootsuite';
    name = 'HootsuiteAdapter';
    description = 'Manage social media via Hootsuite';
    version = '1.0.0';
    scopes = ['offline', 'manage_messages'];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const token = process.env.HOOTSUITE_ACCESS_TOKEN;
        const api = axios.create({
            baseURL: 'https://platform.hootsuite.com/v1',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        switch (actionName) {
            case 'create_message':
                const payload: any = {
                    text: params.text,
                    socialProfileIds: params.socialProfileIds
                };
                if (params.scheduledSendTime) {
                    payload.scheduledSendTime = params.scheduledSendTime;
                }
                const res = await api.post('/messages', payload);
                return res.data;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
