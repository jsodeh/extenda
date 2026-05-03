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
    },
    {
        id: 'delete_file',
        name: 'delete_file',
        description: 'Delete a file or folder from Google Drive',
        parameters: {
            type: 'object',
            required: ['fileId'],
            properties: {
                fileId: { type: 'string', description: 'ID of the file or folder to delete' }
            }
        }
    },
    {
        id: 'get_file',
        name: 'get_file',
        description: 'Get details of a specific file or folder',
        parameters: {
            type: 'object',
            required: ['fileId'],
            properties: {
                fileId: { type: 'string', description: 'File ID' }
            }
        }
    },
    {
        id: 'update_file',
        name: 'update_file',
        description: 'Rename or move a file/folder',
        parameters: {
            type: 'object',
            required: ['fileId'],
            properties: {
                fileId: { type: 'string', description: 'File ID' },
                name: { type: 'string', description: 'New name' },
                addParents: { type: 'string', description: 'Comma-separated parent IDs to add' },
                removeParents: { type: 'string', description: 'Comma-separated parent IDs to remove' }
            }
        }
    },
    {
        id: 'share_file',
        name: 'share_file',
        description: 'Share a file with a specific email',
        parameters: {
            type: 'object',
            required: ['fileId', 'emailAddress', 'role'],
            properties: {
                fileId: { type: 'string', description: 'File ID' },
                emailAddress: { type: 'string', description: 'Email address to share with' },
                role: { type: 'string', description: 'Role (owner, organizer, fileOrganizer, writer, commenter, reader)', enum: ['owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader'] }
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
            process.env.GOOGLE_AUTH_CLIENT_SECRET,
            process.env.GOOGLE_AUTH_REDIRECT_URI
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

            case 'delete_file':
                await drive.files.delete({ fileId: params.fileId });
                return { success: true, message: `File ${params.fileId} deleted` };

            case 'get_file':
                const getRes = await drive.files.get({
                    fileId: params.fileId,
                    fields: 'id, name, mimeType, webViewLink, iconLink'
                });
                return getRes.data;

            case 'update_file':
                const updateRes = await drive.files.update({
                    fileId: params.fileId,
                    addParents: params.addParents,
                    removeParents: params.removeParents,
                    requestBody: {
                        name: params.name
                    }
                });
                return updateRes.data;

            case 'share_file':
                const shareRes = await drive.permissions.create({
                    fileId: params.fileId,
                    requestBody: {
                        role: params.role,
                        type: 'user',
                        emailAddress: params.emailAddress
                    }
                });
                return shareRes.data;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
