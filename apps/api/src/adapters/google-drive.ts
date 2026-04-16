import { google } from 'googleapis';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'list_files',
        name: 'list_files',
        description: 'List files in Google Drive',
        parameters: {
            type: 'object',
            properties: {
                q: { type: 'string', description: 'Query string to filter files' },
                pageSize: { type: 'number', description: 'Number of files to return' }
            }
        }
    },
    {
        id: 'create_folder',
        name: 'create_folder',
        description: 'Create a folder in Google Drive',
        parameters: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', description: 'Folder name' },
                parentId: { type: 'string', description: 'Parent folder ID' }
            }
        }
    }
];

export class GoogleDriveAdapter extends BaseAdapter {
    id = 'google_drive';
    type = 'oauth' as const;
    provider = 'google';
    name = 'GoogleDriveAdapter';
    description = 'Manage Google Drive files';
    version = '1.0.0';
    scopes = ['https://www.googleapis.com/auth/drive'];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        if (context.tokens) {
            auth.setCredentials(context.tokens);
        }

        const drive = google.drive({ version: 'v3', auth });

        switch (actionName) {
            case 'list_files':
                const res = await drive.files.list({
                    q: params.q,
                    pageSize: params.pageSize || 10,
                    fields: 'files(id, name, mimeType)'
                });
                return res.data.files;

            case 'create_folder':
                const fileMetadata = {
                    name: params.name,
                    mimeType: 'application/vnd.google-apps.folder',
                    ...(params.parentId && { parents: [params.parentId] })
                };
                const folder = await drive.files.create({
                    requestBody: fileMetadata,
                    fields: 'id, name'
                });
                return folder.data;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
