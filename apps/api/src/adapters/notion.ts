import { Client } from '@notionhq/client';
import axios from 'axios';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        name: 'create_page',
        description: 'Create a new page in Notion',
        parameters: {
            type: 'object',
            required: ['parent', 'properties'],
            properties: {
                parent: { type: 'object', description: 'Parent database or page ID' },
                properties: { type: 'object', description: 'Page properties' }
            }
        }
    },
    {
        name: 'query_database',
        description: 'Query a Notion database',
        parameters: {
            type: 'object',
            required: ['database_id'],
            properties: {
                database_id: { type: 'string', description: 'Database ID' },
                filter: { type: 'object', description: 'Query filter' }
            }
        }
    }
];

export class NotionAdapter extends BaseAdapter {
    name = 'NotionAdapter';
    description = 'Manage Notion pages and databases';
    version = '1.0.0';
    scopes = [];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const token = process.env.NOTION_TOKEN;
        const notion = new Client({ auth: token });

        switch (actionName) {
            case 'create_page':
                return await notion.pages.create({
                    parent: params.parent,
                    properties: params.properties
                });

            case 'query_database':
                // Using direct HTTP request as notion SDK structure varies by version

                const response = await axios.post(
                    `https://api.notion.com/v1/databases/${params.database_id}/query`,
                    { filter: params.filter },
                    { headers: { 'Authorization': `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' } }
                );
                return response.data;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
