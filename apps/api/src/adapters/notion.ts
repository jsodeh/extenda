import { Client } from '@notionhq/client';
import axios from 'axios';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_page',
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
        id: 'query_database',
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
    },
    {
        id: 'update_page',
        name: 'update_page',
        description: 'Update properties of an existing Notion page',
        parameters: {
            type: 'object',
            required: ['page_id', 'properties'],
            properties: {
                page_id: { type: 'string', description: 'Page ID' },
                properties: { type: 'object', description: 'Properties to update' }
            }
        }
    },
    {
        id: 'get_page',
        name: 'get_page',
        description: 'Retrieve details of a specific Notion page',
        parameters: {
            type: 'object',
            required: ['page_id'],
            properties: {
                page_id: { type: 'string', description: 'Page ID' }
            }
        }
    },
    {
        id: 'append_block',
        name: 'append_block',
        description: 'Append content blocks to a page or block',
        parameters: {
            type: 'object',
            required: ['block_id', 'children'],
            properties: {
                block_id: { type: 'string', description: 'ID of the page or block to append to' },
                children: { type: 'array', description: 'List of block objects to append', items: { type: 'object' } }
            }
        }
    },
    {
        id: 'search',
        name: 'search',
        description: 'Search for pages or databases by title',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search term' },
                filter: { type: 'object', description: 'Filter by object type (e.g., { property: "object", value: "database" })' }
            }
        }
    }
];

export class NotionAdapter extends BaseAdapter {
    id = 'notion';
    type = 'oauth' as const;
    provider = 'notion';
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
                return await notion.databases.query({
                    database_id: params.database_id,
                    filter: params.filter
                });

            case 'update_page':
                return await notion.pages.update({
                    page_id: params.page_id,
                    properties: params.properties
                });

            case 'get_page':
                return await notion.pages.retrieve({
                    page_id: params.page_id
                });

            case 'append_block':
                return await notion.blocks.children.append({
                    block_id: params.block_id,
                    children: params.children
                });

            case 'search':
                return await notion.search({
                    query: params.query,
                    filter: params.filter
                });

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
