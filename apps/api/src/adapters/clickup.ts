import axios from 'axios';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_task',
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
        id: 'get_lists',
        name: 'get_lists',
        description: 'Get lists in a folder',
        parameters: {
            type: 'object',
            required: ['folder_id'],
            properties: {
                folder_id: { type: 'string', description: 'Folder ID' }
            }
        }
    },
    {
        id: 'update_task',
        name: 'update_task',
        description: 'Update an existing ClickUp task',
        parameters: {
            type: 'object',
            required: ['task_id'],
            properties: {
                task_id: { type: 'string', description: 'Task ID' },
                name: { type: 'string', description: 'New task name' },
                description: { type: 'string', description: 'New description' },
                status: { type: 'string', description: 'New status (e.g., "complete")' }
            }
        }
    },
    {
        id: 'get_task',
        name: 'get_task',
        description: 'Get details of a specific ClickUp task',
        parameters: {
            type: 'object',
            required: ['task_id'],
            properties: {
                task_id: { type: 'string', description: 'Task ID' }
            }
        }
    },
    {
        id: 'add_comment',
        name: 'add_comment',
        description: 'Add a comment to a ClickUp task',
        parameters: {
            type: 'object',
            required: ['task_id', 'comment_text'],
            properties: {
                task_id: { type: 'string', description: 'Task ID' },
                comment_text: { type: 'string', description: 'Comment text' }
            }
        }
    },
    {
        id: 'get_teams',
        name: 'get_teams',
        description: 'Get a list of teams (workspaces) the user belongs to',
        parameters: {
            type: 'object',
            properties: {}
        }
    }
];

export class ClickUpAdapter extends BaseAdapter {
    id = 'clickup';
    type = 'oauth' as const;
    provider = 'clickup';
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

            case 'update_task':
                const updateRes = await api.put(`/task/${params.task_id}`, {
                    name: params.name,
                    description: params.description,
                    status: params.status
                });
                return updateRes.data;

            case 'get_task':
                const taskDetailRes = await api.get(`/task/${params.task_id}`);
                return taskDetailRes.data;

            case 'add_comment':
                const commentRes = await api.post(`/task/${params.task_id}/comment`, {
                    comment_text: params.comment_text
                });
                return commentRes.data;

            case 'get_teams':
                const teamRes = await api.get('/team');
                return teamRes.data;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
