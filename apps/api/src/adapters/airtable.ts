import Airtable from 'airtable';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        name: 'create_record',
        description: 'Create a record in an Airtable table',
        parameters: {
            type: 'object',
            required: ['base_id', 'table_name', 'fields'],
            properties: {
                base_id: { type: 'string', description: 'Base ID' },
                table_name: { type: 'string', description: 'Table name' },
                fields: { type: 'object', description: 'Record fields' }
            }
        }
    },
    {
        name: 'get_records',
        description: 'Get records from an Airtable table',
        parameters: {
            type: 'object',
            required: ['base_id', 'table_name'],
            properties: {
                base_id: { type: 'string', description: 'Base ID' },
                table_name: { type: 'string', description: 'Table name' },
                maxRecords: { type: 'number', description: 'Max records to return' }
            }
        }
    }
];

export class AirtableAdapter extends BaseAdapter {
    name = 'AirtableAdapter';
    description = 'Manage Airtable records';
    version = '1.0.0';
    scopes = [];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const apiKey = process.env.AIRTABLE_API_KEY;
        Airtable.configure({ apiKey: apiKey || '' });
        const base = Airtable.base(params.base_id);

        switch (actionName) {
            case 'create_record':
                const created = await base(params.table_name).create([{
                    fields: params.fields
                }]);
                return created[0];

            case 'get_records':
                const records: any[] = [];
                await base(params.table_name).select({
                    maxRecords: params.maxRecords || 10
                }).eachPage((pageRecords, fetchNextPage) => {
                    records.push(...pageRecords);
                    fetchNextPage();
                });
                return records;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
