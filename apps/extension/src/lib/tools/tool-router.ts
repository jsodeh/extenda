/**
 * Unified Tool Router
 * Single source of truth for ALL tools - used by both text orchestrator and Gemini Live voice
 * 
 * This file defines:
 * 1. Tool declarations (for Gemini function calling)
 * 2. Tool execution routing (client-side vs server-side)
 */

// Tool declaration format for Gemini Live
export interface ToolDeclaration {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description: string;
            enum?: string[];
        }>;
        required?: string[];
    };
}

// ============================================================================
// TOOL DECLARATIONS - Used by Gemini Live for function calling
// ============================================================================

export const TOOL_DECLARATIONS: ToolDeclaration[] = [
    // --- Browser Navigation ---
    {
        name: 'open_tab',
        description: 'Open a new browser tab with the specified URL',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The URL to open' }
            },
            required: ['url']
        }
    },
    {
        name: 'close_tab',
        description: 'Close the current browser tab',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'switch_tab',
        description: 'Switch to a specific browser tab by index or title',
        parameters: {
            type: 'object',
            properties: {
                index: { type: 'number', description: 'Tab index (0-based)' },
                title: { type: 'string', description: 'Partial title to match' }
            }
        }
    },

    // --- Page Interaction ---
    {
        name: 'smart_click',
        description: 'Click on an element described in natural language. Uses AI vision to find the element.',
        parameters: {
            type: 'object',
            properties: {
                description: { type: 'string', description: 'Description of what to click, e.g. "the blue Submit button"' }
            },
            required: ['description']
        }
    },
    {
        name: 'read_page',
        description: 'Read the text content of the current page or a specific element',
        parameters: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector to read specific content (optional)' }
            }
        }
    },
    {
        name: 'fill_form',
        description: 'Fill a form field with a value',
        parameters: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector for the input field' },
                value: { type: 'string', description: 'Value to fill' }
            },
            required: ['selector', 'value']
        }
    },
    {
        name: 'screenshot',
        description: 'Take a screenshot of the current page',
        parameters: {
            type: 'object',
            properties: {}
        }
    },

    // --- Gmail ---
    {
        name: 'send_email',
        description: 'Compose and send an email via Gmail',
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body content' }
            },
            required: ['to', 'subject', 'body']
        }
    },
    {
        name: 'get_emails',
        description: 'Get recent emails from Gmail inbox',
        parameters: {
            type: 'object',
            properties: {
                count: { type: 'number', description: 'Number of emails to retrieve (default: 5)' },
                query: { type: 'string', description: 'Search query to filter emails' }
            }
        }
    },

    // --- Google Calendar ---
    {
        name: 'create_calendar_event',
        description: 'Create a new event on Google Calendar',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Event title' },
                start: { type: 'string', description: 'Start time (ISO format or natural language)' },
                end: { type: 'string', description: 'End time (ISO format or natural language)' },
                description: { type: 'string', description: 'Event description' },
                location: { type: 'string', description: 'Event location' }
            },
            required: ['title', 'start']
        }
    },
    {
        name: 'get_calendar_events',
        description: 'Get upcoming calendar events',
        parameters: {
            type: 'object',
            properties: {
                days: { type: 'number', description: 'Number of days to look ahead (default: 7)' }
            }
        }
    },

    // --- Google Drive ---
    {
        name: 'search_drive',
        description: 'Search for files in Google Drive',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
        }
    },

    // --- Notifications ---
    {
        name: 'notify',
        description: 'Show a browser notification to the user',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Notification title' },
                message: { type: 'string', description: 'Notification message' }
            },
            required: ['message']
        }
    },

    // --- General ---
    {
        name: 'get_current_time',
        description: 'Get the current date and time',
        parameters: {
            type: 'object',
            properties: {}
        }
    }
];

// ============================================================================
// TOOL ROUTING - Which tools run where
// ============================================================================

// Tools that execute in the browser extension (background.ts)
export const CLIENT_TOOLS = [
    'open_tab', 'close_tab', 'switch_tab', 'list_tabs',
    'smart_click', 'read_page', 'fill_form', 'screenshot',
    'notify', 'get_current_time'
];

// Tools that require API calls to the server
export const SERVER_TOOLS = [
    'send_email', 'get_emails',
    'create_calendar_event', 'get_calendar_events',
    'search_drive',
    'send_slack_message',
    'create_notion_page'
];

// ============================================================================
// TOOL EXECUTION
// ============================================================================

export type ToolExecutionContext = {
    accessToken?: string;
    apiUrl?: string;
    sessionId?: string;
};

/**
 * Execute a tool by name
 * Routes to client-side (chrome extension) or server-side (API) based on tool type
 */
export async function executeTool(
    name: string,
    args: Record<string, any>,
    context: ToolExecutionContext
): Promise<any> {
    console.log(`[ToolRouter] Executing ${name}:`, args);

    // Handle instant tools
    if (name === 'get_current_time') {
        return { time: new Date().toLocaleString(), timestamp: Date.now() };
    }

    // Route to client or server
    if (CLIENT_TOOLS.includes(name)) {
        return executeClientTool(name, args);
    } else if (SERVER_TOOLS.includes(name)) {
        return executeServerTool(name, args, context);
    } else {
        throw new Error(`Unknown tool: ${name}`);
    }
}

/**
 * Execute a client-side tool via Chrome extension messaging
 */
async function executeClientTool(name: string, args: Record<string, any>): Promise<any> {
    // Map tool names to existing handlers
    const toolMapping: Record<string, { handler: string; params: any }> = {
        'open_tab': { handler: 'TabManager', params: { action: 'open', url: args.url } },
        'close_tab': { handler: 'TabManager', params: { action: 'close' } },
        'switch_tab': { handler: 'TabManager', params: { action: 'switch', ...args } },
        'list_tabs': { handler: 'TabManager', params: { action: 'list' } },
        'smart_click': { handler: 'SmartClick', params: args },
        'screenshot': { handler: 'Screenshot', params: {} },
        'read_page': { handler: 'DOMReader', params: { action: 'read', ...args } },
        'fill_form': { handler: 'FormFiller', params: { action: 'fill', fields: [args] } },
        'notify': { handler: 'Notifier', params: { action: 'notify', ...args } }
    };

    const mapping = toolMapping[name];
    if (!mapping) {
        throw new Error(`No client mapping for tool: ${name}`);
    }

    // Send to background script for execution
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { type: 'EXECUTE_TOOL', tool: mapping.handler, params: mapping.params },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response?.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response?.result || response);
                }
            }
        );
    });
}

/**
 * Execute a server-side tool via API call
 */
async function executeServerTool(
    name: string,
    args: Record<string, any>,
    context: ToolExecutionContext
): Promise<any> {
    const apiUrl = context.apiUrl || 'https://extenda-pxa6.onrender.com';

    // Map tool names to API endpoints
    const endpointMapping: Record<string, { endpoint: string; method: string }> = {
        'send_email': { endpoint: '/api/tools/gmail/send', method: 'POST' },
        'get_emails': { endpoint: '/api/tools/gmail/list', method: 'GET' },
        'create_calendar_event': { endpoint: '/api/tools/calendar/create', method: 'POST' },
        'get_calendar_events': { endpoint: '/api/tools/calendar/list', method: 'GET' },
        'search_drive': { endpoint: '/api/tools/drive/search', method: 'GET' }
    };

    const mapping = endpointMapping[name];
    if (!mapping) {
        throw new Error(`No server mapping for tool: ${name}`);
    }

    const response = await fetch(`${apiUrl}${mapping.endpoint}`, {
        method: mapping.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${context.accessToken}`
        },
        body: mapping.method === 'POST' ? JSON.stringify(args) : undefined
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${error}`);
    }

    return response.json();
}

// ============================================================================
// HELPER: Get declarations for Gemini Live setup
// ============================================================================

export function getGeminiToolDeclarations() {
    return TOOL_DECLARATIONS.map(tool => ({
        function_declarations: [{
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }]
    }));
}
