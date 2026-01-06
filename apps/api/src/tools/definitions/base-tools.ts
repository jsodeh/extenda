import { Tool } from '@extenda/shared';

export const FormFillerTool: Tool = {
    name: 'FormFiller',
    description: 'Fill forms, click buttons, and interact with web page elements. Runs in browser context.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['fill_text', 'click', 'select', 'submit', 'fill_form'],
                description: 'Action to perform'
            },
            selector: {
                type: 'string',
                description: 'CSS selector for the element'
            },
            value: {
                type: 'string',
                description: 'Value to fill or select'
            },
            formData: {
                type: 'object',
                description: 'Map of selectors to values for fill_form action'
            }
        },
        required: ['action']
    }
};

export const NotifierTool: Tool = {
    name: 'Notifier',
    description: 'Show desktop notifications, confirmations, and prompts to the user.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['notify', 'confirm', 'prompt'],
                description: 'Type of notification'
            },
            title: {
                type: 'string',
                description: 'Notification title (for notify action)'
            },
            message: {
                type: 'string',
                description: 'Notification message'
            },
            type: {
                type: 'string',
                enum: ['info', 'success', 'warning', 'error'],
                description: 'Notification type (default: info)'
            }
        },
        required: ['action', 'message']
    }
};

export const AIProcessorTool: Tool = {
    name: 'AIProcessor',
    description: 'Process content using AI: summarize, categorize, extract information, or analyze.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['summarize', 'categorize', 'extract', 'analyze'],
                description: 'AI processing action'
            },
            content: {
                type: 'string',
                description: 'Content to process'
            },
            options: {
                type: 'object',
                properties: {
                    maxLength: {
                        type: 'number',
                        description: 'Max summary length (for summarize)'
                    },
                    categories: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Available categories (for categorize)'
                    },
                    extractFields: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Fields to extract (for extract)'
                    }
                }
            }
        },
        required: ['action', 'content']
    }
};
