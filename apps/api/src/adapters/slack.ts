import { WebClient } from '@slack/web-api';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'send_message',
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
        id: 'get_history',
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
    },
    {
        id: 'list_channels',
        name: 'list_channels',
        description: 'List all public and private channels the bot is in',
        parameters: {
            type: 'object',
            properties: {
                types: { type: 'string', description: 'Comma-separated list of channel types (public_channel,private_channel)' }
            }
        }
    },
    {
        id: 'get_user',
        name: 'get_user',
        description: 'Get information about a specific Slack user',
        parameters: {
            type: 'object',
            required: ['user'],
            properties: {
                user: { type: 'string', description: 'User ID' }
            }
        }
    },
    {
        id: 'search_messages',
        name: 'search_messages',
        description: 'Search for messages across all channels',
        parameters: {
            type: 'object',
            required: ['query'],
            properties: {
                query: { type: 'string', description: 'Search query' },
                count: { type: 'number', description: 'Number of results to return' }
            }
        }
    },
    {
        id: 'add_reaction',
        name: 'add_reaction',
        description: 'Add an emoji reaction to a message',
        parameters: {
            type: 'object',
            required: ['channel', 'timestamp', 'name'],
            properties: {
                channel: { type: 'string', description: 'Channel ID where the message is' },
                timestamp: { type: 'string', description: 'Timestamp of the message' },
                name: { type: 'string', description: 'Emoji name (without colons, e.g., thumbsup)' }
            }
        }
    },
    {
        id: 'reply_to_thread',
        name: 'reply_to_thread',
        description: 'Reply to a specific message thread',
        parameters: {
            type: 'object',
            required: ['channel', 'thread_ts', 'text'],
            properties: {
                channel: { type: 'string', description: 'Channel ID' },
                thread_ts: { type: 'string', description: 'Timestamp of the parent message' },
                text: { type: 'string', description: 'Reply text' }
            }
        }
    }
];

export class SlackAdapter extends BaseAdapter {
    id = 'slack';
    type = 'oauth' as const;
    provider = 'slack';
    name = 'SlackAdapter';
    description = 'Manage Slack messages and channels';
    version = '1.0.0';
    scopes = [
        'chat:write', 
        'channels:history', 
        'groups:history', 
        'channels:read', 
        'groups:read', 
        'users:read', 
        'search:read', 
        'reactions:write'
    ];
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

            case 'list_channels':
                const channels = await client.conversations.list({
                    types: params.types || 'public_channel,private_channel',
                    exclude_archived: true
                });
                return channels.channels;

            case 'get_user':
                const userInfo = await client.users.info({
                    user: params.user
                });
                return userInfo.user;

            case 'search_messages':
                const searchResults = await client.search.messages({
                    query: params.query,
                    count: params.count || 10
                });
                return searchResults.messages;

            case 'add_reaction':
                const reactionResult = await client.reactions.add({
                    channel: params.channel,
                    timestamp: params.timestamp,
                    name: params.name
                });
                return { ok: reactionResult.ok };

            case 'reply_to_thread':
                const threadResult = await client.chat.postMessage({
                    channel: params.channel,
                    thread_ts: params.thread_ts,
                    text: params.text
                });
                return { ok: threadResult.ok, ts: threadResult.ts };

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
