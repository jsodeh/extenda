import { Tool } from '@extenda/shared';

export const DOMReaderTool: Tool = {
    name: 'DOMReader',
    description: 'Extract content from web pages, find elements, and read page metadata. Runs in the browser context.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['extract_text', 'extract_structured', 'find_element', 'get_metadata'],
                description: 'Action to perform'
            },
            selector: {
                type: 'string',
                description: 'CSS selector (optional, for extract_text)'
            },
            schema: {
                type: 'object',
                description: 'Schema for structured extraction (e.g., {title: "h1", author: ".author"})'
            },
            description: {
                type: 'string',
                description: 'Natural language description for find_element'
            }
        },
        required: ['action']
    }
};

export const GmailScraperTool: Tool = {
    name: 'GmailScraper',
    description: 'Extract emails from Gmail inbox. Must be on mail.google.com.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['get_inbox', 'get_open_email', 'search', 'get_unread_count'],
                description: 'Gmail action to perform'
            },
            limit: {
                type: 'number',
                description: 'Number of emails to fetch (default: 10)'
            },
            query: {
                type: 'string',
                description: 'Search query (required for search action)'
            }
        },
        required: ['action']
    }
};
