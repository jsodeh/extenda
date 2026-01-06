import axios from 'axios';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        name: 'create_post',
        description: 'Create a social media post via Buffer',
        parameters: {
            type: 'object',
            required: ['profile_ids', 'text'],
            properties: {
                profile_ids: { type: 'array', items: { type: 'string' }, description: 'Social profile IDs' },
                text: { type: 'string', description: 'Post text' },
                now: { type: 'boolean', description: 'Post immediately or schedule' }
            }
        }
    }
];

export class BufferAdapter extends BaseAdapter {
    name = 'BufferAdapter';
    description = 'Manage social media posts via Buffer';
    version = '1.0.0';
    scopes = [];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const token = process.env.BUFFER_ACCESS_TOKEN;
        const api = axios.create({
            baseURL: 'https://api.bufferapp.com/1',
            params: { access_token: token }
        });

        switch (actionName) {
            case 'create_post':
                const updates = await Promise.all(
                    params.profile_ids.map((profile_id: string) =>
                        api.post('/updates/create.json', {
                            profile_ids: [profile_id],
                            text: params.text,
                            now: params.now || false
                        })
                    )
                );
                return updates.map(u => u.data);

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
