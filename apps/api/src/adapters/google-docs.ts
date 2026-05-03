import { google } from 'googleapis';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'read_doc',
        name: 'read_doc',
        description: 'Read the contents of a Google Doc',
        parameters: {
            type: 'object',
            required: ['documentId'],
            properties: {
                documentId: { type: 'string', description: 'The ID of the document to read.' }
            }
        }
    },
    {
        id: 'create_doc',
        name: 'create_doc',
        description: 'Create a new blank Google Doc',
        parameters: {
            type: 'object',
            required: ['title'],
            properties: {
                title: { type: 'string', description: 'The title of the new document.' }
            }
        }
    }
];

export class GoogleDocsAdapter extends BaseAdapter {
    id = 'google_docs';
    type = 'oauth' as const;
    provider = 'google';
    name = 'GoogleDocsAdapter';
    description = 'Read and create Google Docs';
    version = '1.0.0';
    scopes = [
        'https://www.googleapis.com/auth/documents.readonly',
        'https://www.googleapis.com/auth/documents'
    ];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_AUTH_CLIENT_SECRET,
            process.env.GOOGLE_AUTH_REDIRECT_URI
        );

        if (context.tokens) {
            auth.setCredentials(context.tokens);
        } else {
            throw new Error('Authentication required: No tokens found for GoogleDocsAdapter');
        }

        const docs = google.docs({ version: 'v1', auth });

        switch (actionName) {
            case 'read_doc':
                const docRes = await docs.documents.get({
                    documentId: params.documentId
                });
                return docRes.data;

            case 'create_doc':
                const createRes = await docs.documents.create({
                    requestBody: {
                        title: params.title
                    }
                });
                return createRes.data;

            default:
                throw new Error(`Action ${actionName} not supported in GoogleDocsAdapter`);
        }
    }
}
