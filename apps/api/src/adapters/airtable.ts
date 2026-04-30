import Airtable from 'airtable';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_record',
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
        id: 'get_records',
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
    },
    {
        id: 'update_record',
        name: 'update_record',
        description: 'Update an existing record in Airtable',
        parameters: {
            type: 'object',
            required: ['base_id', 'table_name', 'record_id', 'fields'],
            properties: {
                base_id: { type: 'string', description: 'Base ID' },
                table_name: { type: 'string', description: 'Table name' },
                record_id: { type: 'string', description: 'ID of the record to update' },
                fields: { type: 'object', description: 'New field values' }
            }
        }
    },
    {
        id: 'delete_record',
        name: 'delete_record',
        description: 'Delete a record from Airtable',
        parameters: {
            type: 'object',
            required: ['base_id', 'table_name', 'record_id'],
            properties: {
                base_id: { type: 'string', description: 'Base ID' },
                table_name: { type: 'string', description: 'Table name' },
                record_id: { type: 'string', description: 'ID of the record to delete' }
            }
        }
    },
    {
        id: 'get_record',
        name: 'get_record',
        description: 'Retrieve a specific record from Airtable',
        parameters: {
            type: 'object',
            required: ['base_id', 'table_name', 'record_id'],
            properties: {
                base_id: { type: 'string', description: 'Base ID' },
                table_name: { type: 'string', description: 'Table name' },
                record_id: { type: 'string', description: 'ID of the record to retrieve' }
            }
        }
    }
];

export class AirtableAdapter extends BaseAdapter {
    id = 'airtable';
    type = 'oauth' as const;
    provider = 'airtable';
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

            case 'update_record':
                return await base(params.table_name).update(params.record_id, params.fields);

            case 'delete_record':
                return await base(params.table_name).destroy(params.record_id);

            case 'get_record':
                return await base(params.table_name).find(params.record_id);

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
