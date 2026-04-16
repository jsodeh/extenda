import { Client } from '@hubspot/api-client';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_contact',
        name: 'create_contact',
        description: 'Create a contact in HubSpot',
        parameters: {
            type: 'object',
            required: ['properties'],
            properties: {
                properties: { type: 'object', description: 'Contact properties (email, firstname, lastname, etc.)' }
            }
        }
    },
    {
        id: 'get_deals',
        name: 'get_deals',
        description: 'Get deals from HubSpot',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Max deals to return' }
            }
        }
    }
];

export class HubSpotAdapter extends BaseAdapter {
    id = 'hubspot';
    type = 'oauth' as const;
    provider = 'hubspot';
    name = 'HubSpotAdapter';
    description = 'Manage HubSpot CRM';
    version = '1.0.0';
    scopes = ['crm.objects.contacts.write', 'crm.objects.deals.read'];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
        const client = new Client({ accessToken });

        switch (actionName) {
            case 'create_contact':
                return await client.crm.contacts.basicApi.create({
                    properties: params.properties
                });

            case 'get_deals':
                const response = await client.crm.deals.basicApi.getPage(params.limit || 10);
                return response.results;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
