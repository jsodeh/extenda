import { google } from 'googleapis';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'read_sheet',
        name: 'read_sheet',
        description: 'Read data from a Google Sheet',
        parameters: {
            type: 'object',
            required: ['spreadsheetId', 'range'],
            properties: {
                spreadsheetId: { type: 'string', description: 'The ID of the spreadsheet.' },
                range: { type: 'string', description: 'The A1 notation of the range to retrieve (e.g. Sheet1!A1:D5).' }
            }
        }
    },
    {
        id: 'create_sheet',
        name: 'create_sheet',
        description: 'Create a new blank Google Sheet',
        parameters: {
            type: 'object',
            required: ['title'],
            properties: {
                title: { type: 'string', description: 'The title of the new spreadsheet.' }
            }
        }
    },
    {
        id: 'append_data',
        name: 'append_data',
        description: 'Append rows of data to a sheet',
        parameters: {
            type: 'object',
            required: ['spreadsheetId', 'range', 'values'],
            properties: {
                spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
                range: { type: 'string', description: 'A1 notation of range to search for table end (e.g. Sheet1!A1)' },
                values: { type: 'array', items: { type: 'array', items: { type: 'any' } }, description: '2D array of values to append' }
            }
        }
    },
    {
        id: 'update_data',
        name: 'update_data',
        description: 'Update a range of cells in a sheet',
        parameters: {
            type: 'object',
            required: ['spreadsheetId', 'range', 'values'],
            properties: {
                spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
                range: { type: 'string', description: 'A1 notation of range to update' },
                values: { type: 'array', items: { type: 'array', items: { type: 'any' } }, description: '2D array of new values' }
            }
        }
    },
    {
        id: 'get_spreadsheet',
        name: 'get_spreadsheet',
        description: 'Get spreadsheet metadata and sheet names',
        parameters: {
            type: 'object',
            required: ['spreadsheetId'],
            properties: {
                spreadsheetId: { type: 'string', description: 'Spreadsheet ID' }
            }
        }
    }
];

export class GoogleSheetsAdapter extends BaseAdapter {
    id = 'google_sheets';
    type = 'oauth' as const;
    provider = 'google';
    name = 'GoogleSheetsAdapter';
    description = 'Read and create Google Sheets';
    version = '1.0.0';
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/spreadsheets'
    ];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        if (context.tokens) {
            auth.setCredentials(context.tokens);
        } else {
            throw new Error('Authentication required: No tokens found for GoogleSheetsAdapter');
        }

        const sheets = google.sheets({ version: 'v4', auth });

        switch (actionName) {
            case 'read_sheet':
                const sheetRes = await sheets.spreadsheets.values.get({
                    spreadsheetId: params.spreadsheetId,
                    range: params.range
                });
                return sheetRes.data.values;

            case 'create_sheet':
                const createRes = await sheets.spreadsheets.create({
                    requestBody: {
                        properties: {
                            title: params.title
                        }
                    }
                });
                return createRes.data;

            case 'append_data':
                const appendRes = await sheets.spreadsheets.values.append({
                    spreadsheetId: params.spreadsheetId,
                    range: params.range,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: params.values
                    }
                });
                return appendRes.data;

            case 'update_data':
                const updateRes = await sheets.spreadsheets.values.update({
                    spreadsheetId: params.spreadsheetId,
                    range: params.range,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: params.values
                    }
                });
                return updateRes.data;

            case 'get_spreadsheet':
                const getRes = await sheets.spreadsheets.get({
                    spreadsheetId: params.spreadsheetId
                });
                return getRes.data;

            default:
                throw new Error(`Action ${actionName} not supported in GoogleSheetsAdapter`);
        }
    }
}
