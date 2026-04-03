import { createClerkClient } from '@clerk/chrome-extension/background';
import { bgWsClient } from '../lib/websocket-background';
import { handleTabManager } from '../lib/tools/tab-manager';
import { handleScreenshot } from '../lib/tools/screenshot';
import { handleSmartClick } from '../lib/tools/smart-click';
import { ToolExecutionRequest } from '@extenda/shared';

// Initialize Clerk in background
const clerkPromise = createClerkClient({
    publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
});

// Content script tool types
const CONTENT_SCRIPT_TOOLS = ['DOMReader', 'FormFiller', 'GmailScraper'];
const MESSAGE_TYPE_MAP: Record<string, string> = {
    'DOMReader': 'EXECUTE_DOM_READER',
    'FormFiller': 'EXECUTE_FORM_FILLER',
    'GmailScraper': 'EXECUTE_GMAIL_SCRAPER'
};

/**
 * Execute a tool via content script
 */
async function executeContentScriptTool(tool: string, params: any): Promise<any> {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    console.log(`[Background] Executing ${tool} on tab ${tab.id}: ${tab.url}`);

    // Send message to content script
    try {
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: MESSAGE_TYPE_MAP[tool],
            action: params.action,
            params
        });

        console.log(`[Background] Content script response:`, response);

        if (!response || !response.success) {
            throw new Error(response?.error || 'Content script execution failed');
        }

        return response.data;
    } catch (error: any) {
        // Check if content script not loaded
        if (error.message?.includes('Could not establish connection') ||
            error.message?.includes('Receiving end does not exist')) {
            throw new Error('Content script not loaded on this page. Try refreshing the page.');
        }
        throw error;
    }
}

// Tool Execution Dispatcher
const handleToolExecution = async (data: ToolExecutionRequest) => {
    console.log('[Background] Received tool execution request:', data);
    const { executionId, stepId, tool, params } = data;

    try {
        let result;

        if (tool === 'TabManager') {
            result = await handleTabManager(params);
        } else if (tool === 'Screenshot') {
            // New: Screenshot capture
            result = await handleScreenshot(params);
        } else if (tool === 'SmartClick') {
            // New: Vision-based smart click
            result = await handleSmartClick(params);
        } else if (tool === 'Notifier') {
            console.log('[Background] Processing Notifier request:', params);
            if (params.action === 'notify') {
                try {
                    const notificationId = await chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icon-128.png',
                        title: params.title || 'Extenda',
                        message: params.message
                    });
                    console.log('[Background] Notification created:', notificationId);
                    result = { success: true, notificationId };
                } catch (err) {
                    console.error('[Background] Chrome notification failed:', err);
                    result = { success: true, warning: 'Notification API failed, but step assumed complete.' };
                }
            } else {
                throw new Error(`Notifier action ${params.action} not yet implemented`);
            }
        } else if (CONTENT_SCRIPT_TOOLS.includes(tool)) {
            // Route to content script
            result = await executeContentScriptTool(tool, params);
        } else {
            throw new Error(`Unknown client tool: ${tool}`);
        }

        // Send success result
        bgWsClient.emit('tool:result', {
            executionId,
            stepId,
            status: 'success',
            result
        });
        console.log('[Background] Sent tool result: success');

    } catch (error: any) {
        console.error('[Background] Tool execution failed:', error);
        bgWsClient.emit('tool:result', {
            executionId,
            stepId,
            status: 'error',
            error: error.message
        });
    }
};

// Track if listener is registered to prevent duplicates
let toolExecuteListenerRegistered = false;

// Initialize connection with Clerk
const initConnection = async () => {
    try {
        console.log('[Background] Initializing Clerk session sync...');
        
        const clerk = await clerkPromise;
        
        // Listen for session changes
        clerk.addListener(async (resources) => {
            const { session } = resources;
            if (session) {
                console.log('[Background] Clerk session active, fetching token...');
                try {
                    const token = await session.getToken();
                    if (token) {
                        console.log('[Background] Connecting WebSocket with Clerk token');
                        bgWsClient.connect(token);

                        // Register tool execution listener ONCE
                        if (!toolExecuteListenerRegistered) {
                            bgWsClient.on('tool:execute', handleToolExecution);
                            toolExecuteListenerRegistered = true;
                            console.log('[Background] Registered tool:execute listener');
                        }
                    }
                } catch (tokenErr) {
                    console.error('[Background] Failed to get Clerk token:', tokenErr);
                }
            } else {
                console.log('[Background] No active Clerk session, disconnecting...');
                bgWsClient.disconnect();
            }
        });
    } catch (error) {
        console.error('[Background] Clerk initialization failed:', error);
    }
};

initConnection();

// Removed manual storage listeners as Clerk handles this now via addListener

// Listen for tab updates to track context
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        console.log('[Background] Active tab changed:', tab.url);
    } catch (e) {
        console.error('[Background] Error getting active tab:', e);
    }
});

// Setup side panel behavior
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));
}

// ============================================================================
// EXECUTE_TOOL Message Handler (for voice mode tool execution)
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_TOOL') {
        const { tool, params } = message;
        console.log('[Background] EXECUTE_TOOL:', tool, params);

        (async () => {
            try {
                let result;

                if (tool === 'TabManager') {
                    result = await handleTabManager(params);
                } else if (tool === 'Screenshot') {
                    result = await handleScreenshot(params);
                } else if (tool === 'SmartClick') {
                    result = await handleSmartClick(params);
                } else if (tool === 'Notifier') {
                    if (params.action === 'notify') {
                        const notificationId = await chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'icon-128.png',
                            title: params.title || 'Extenda',
                            message: params.message
                        });
                        result = { success: true, notificationId };
                    } else {
                        throw new Error(`Notifier action ${params.action} not supported`);
                    }
                } else if (CONTENT_SCRIPT_TOOLS.includes(tool)) {
                    result = await executeContentScriptTool(tool, params);
                } else {
                    throw new Error(`Unknown tool: ${tool}`);
                }

                sendResponse({ result });
            } catch (error: any) {
                console.error('[Background] EXECUTE_TOOL error:', error);
                sendResponse({ error: error.message });
            }
        })();

        return true; // Keep channel open for async response
    }
});

console.log('[Background] Extenda Background Service Worker Initialized');

