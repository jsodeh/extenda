import { WebClient } from '@slack/web-api';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        name: 'send_message',
        description: 'Send a message to a Slack channel',
        parameters: {
            type: 'object',
            required: ['channel', 'text'],
            properties: {
                channel: { type: 'string', description: 'Channel ID or name (e.g., #general)' },
                text: { type: 'string', description: 'Message text' }
            }
        }
    },
    {
        name: 'get_history',
        description: 'Get message history from a channel',
        parameters: {
            type: 'object',
            required: ['channel'],
            properties: {
                channel: { type: 'string', description: 'Channel ID' },
                limit: { type: 'number', description: 'Number of messages to retrieve (max 100)' }
            }
        }
    }
];

export class SlackAdapter extends BaseAdapter {
    name = 'SlackAdapter';
    description = 'Manage Slack messages and channels';
    version = '1.0.0';
    scopes = ['chat:write', 'channels:history', 'groups:history'];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        // TODO: Retrieve token from context/DB
        // const token = context.tokens?.access_token || process.env.SLACK_BOT_TOKEN;
        const token = process.env.SLACK_BOT_TOKEN;

        if (!token) {
            console.warn('No Slack token provided');
            // throw new Error('Slack authentication required');
        }

        const client = new WebClient(token);

        switch (actionName) {
            case 'send_message':
                const result = await client.chat.postMessage({
                    channel: params.channel,
                    text: params.text
                });
                return { ok: result.ok, ts: result.ts };

            case 'get_history':
                const history = await client.conversations.history({
                    channel: params.channel,
                    limit: params.limit || 10
                });
                return history.messages;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
