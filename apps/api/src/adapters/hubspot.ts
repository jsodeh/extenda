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
    },
    {
        id: 'search_contacts',
        name: 'search_contacts',
        description: 'Search for contacts in HubSpot',
        parameters: {
            type: 'object',
            required: ['filterGroups'],
            properties: {
                filterGroups: { type: 'array', items: { type: 'object' }, description: 'Search filters' },
                properties: { type: 'array', items: { type: 'string' }, description: 'Properties to retrieve' }
            }
        }
    },
    {
        id: 'get_contact',
        name: 'get_contact',
        description: 'Get details of a specific contact',
        parameters: {
            type: 'object',
            required: ['contactId'],
            properties: {
                contactId: { type: 'string', description: 'Contact ID' },
                properties: { type: 'array', items: { type: 'string' }, description: 'Properties to retrieve' }
            }
        }
    },
    {
        id: 'create_deal',
        name: 'create_deal',
        description: 'Create a deal in HubSpot',
        parameters: {
            type: 'object',
            required: ['properties'],
            properties: {
                properties: { type: 'object', description: 'Deal properties (dealname, amount, etc.)' }
            }
        }
    },
    {
        id: 'list_companies',
        name: 'list_companies',
        description: 'List companies in HubSpot',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Max companies to return' }
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
    scopes = [
        'crm.objects.contacts.read',
        'crm.objects.contacts.write',
        'crm.objects.deals.read',
        'crm.objects.deals.write',
        'crm.objects.companies.read'
    ];
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
                const dealsRes = await client.crm.deals.basicApi.getPage(params.limit || 10);
                return dealsRes.results;

            case 'search_contacts':
                return await client.crm.contacts.searchApi.doSearch({
                    filterGroups: params.filterGroups,
                    properties: params.properties
                });

            case 'get_contact':
                return await client.crm.contacts.basicApi.getById(params.contactId, params.properties);

            case 'create_deal':
                return await client.crm.deals.basicApi.create({
                    properties: params.properties
                });

            case 'list_companies':
                const companiesRes = await client.crm.companies.basicApi.getPage(params.limit || 10);
                return companiesRes.results;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
