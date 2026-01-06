import axios from 'axios';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        name: 'create_task',
        description: 'Create a new task in ClickUp',
        parameters: {
            type: 'object',
            required: ['list_id', 'name'],
            properties: {
                list_id: { type: 'string', description: 'List ID' },
                name: { type: 'string', description: 'Task Name' },
                description: { type: 'string', description: 'Task Description' }
            }
        }
    },
    {
        name: 'get_lists',
        description: 'Get lists in a folder',
        parameters: {
            type: 'object',
            required: ['folder_id'],
            properties: {
                folder_id: { type: 'string', description: 'Folder ID' }
            }
        }
    }
];

export class ClickUpAdapter extends BaseAdapter {
    name = 'ClickUpAdapter';
    description = 'Manage ClickUp tasks';
    version = '1.0.0';
    scopes = [];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const token = process.env.CLICKUP_API_TOKEN;
        const api = axios.create({
            baseURL: 'https://api.clickup.com/api/v2',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });

        switch (actionName) {
            case 'create_task':
                const res = await api.post(`/list/${params.list_id}/task`, {
                    name: params.name,
                    description: params.description
                });
                return res.data;

            case 'get_lists':
                const listRes = await api.get(`/folder/${params.folder_id}/list`);
                return listRes.data;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
