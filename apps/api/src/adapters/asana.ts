import Asana from 'asana';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_task',
        name: 'create_task',
        description: 'Create a new task in Asana',
        parameters: {
            type: 'object',
            required: ['name', 'projects'],
            properties: {
                name: { type: 'string', description: 'Task name' },
                notes: { type: 'string', description: 'Task description/notes' },
                projects: { type: 'array', items: { type: 'string' }, description: 'Array of project IDs' },
                workspace: { type: 'string', description: 'Workspace ID (optional if default)' }
            }
        }
    },
    {
        id: 'get_tasks',
        name: 'get_tasks',
        description: 'Get tasks from a project',
        parameters: {
            type: 'object',
            required: ['project'],
            properties: {
                project: { type: 'string', description: 'Project ID' },
                limit: { type: 'number', description: 'Max tasks to return' }
            }
        }
    }
];

export class AsanaAdapter extends BaseAdapter {
    id = 'asana';
    type = 'oauth' as const;
    provider = 'asana';
    name = 'AsanaAdapter';
    description = 'Manage Asana tasks and projects';
    version = '1.0.0';
    scopes = ['default'];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const accessToken = process.env.ASANA_ACCESS_TOKEN;
        if (!accessToken) {
            // throw new Error('Asana authentication required');
            console.warn('No Asana token provided');
        }

        const client = Asana.Client.create().useAccessToken(accessToken || '');

        switch (actionName) {
            case 'create_task':
                return await client.tasks.create({
                    name: params.name,
                    notes: params.notes,
                    projects: params.projects,
                    workspace: params.workspace
                });

            case 'get_tasks':
                const tasks = await client.tasks.findAll({ project: params.project, limit: params.limit || 10 });
                return tasks.data;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
