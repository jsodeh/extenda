import { bgWsClient } from '../lib/websocket-background';
import { handleTabManager } from '../lib/tools/tab-manager';
import { handleScreenshot } from '../lib/tools/screenshot';
import { handleSmartClick } from '../lib/tools/smart-click';
import { ToolExecutionRequest } from '@extenda/shared';

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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    console.log(`[Background] Executing ${tool} on tab ${tab.id}: ${tab.url}`);

    try {
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: MESSAGE_TYPE_MAP[tool],
            action: params.action,
            params
        });

        if (!response || !response.success) {
            throw new Error(response?.error || 'Content script execution failed');
        }

        return response.data;
    } catch (error: any) {
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
                throw new Error(`Notifier action ${params.action} not yet implemented`);
            }
        } else if (CONTENT_SCRIPT_TOOLS.includes(tool)) {
            result = await executeContentScriptTool(tool, params);
        } else {
            throw new Error(`Unknown client tool: ${tool}`);
        }

        bgWsClient.emit('tool:result', {
            executionId,
            stepId,
            status: 'success',
            result
        });
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

let toolExecuteListenerRegistered = false;

// Initialize connection with shared token from storage
const initConnection = async () => {
    console.log('[Background] Initializing session sync via storage...');
    
    // 1. Initial check
    const data = await chrome.storage.local.get('accessToken');
    if (data.accessToken) {
        syncSession(data.accessToken);
    } else {
        console.log('[Background] No active session found on startup');
    }

    // 2. Listen for storage changes (Login/Logout from sidepanel)
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.accessToken) {
            const newToken = changes.accessToken.newValue;
            if (newToken) {
                syncSession(newToken);
            } else {
                console.log('[Background] Session cleared, disconnecting WebSocket');
                bgWsClient.disconnect();
            }
        }
    });
};

const syncSession = (token: string) => {
    console.log('[Background] Syncing session, connecting WebSocket...');
    bgWsClient.connect(token);

    if (!toolExecuteListenerRegistered) {
        bgWsClient.on('tool:execute', handleToolExecution);
        toolExecuteListenerRegistered = true;
        console.log('[Background] Registered tool:execute listener');
    }
};

initConnection();

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_TOOL') {
        const { tool, params } = message;
        (async () => {
            try {
                let result;
                if (tool === 'TabManager') result = await handleTabManager(params);
                else if (tool === 'Screenshot') result = await handleScreenshot(params);
                else if (tool === 'SmartClick') result = await handleSmartClick(params);
                else if (tool === 'Notifier' && params.action === 'notify') {
                    const notificationId = await chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icon-128.png',
                        title: params.title || 'Extenda',
                        message: params.message
                    });
                    result = { success: true, notificationId };
                } else if (CONTENT_SCRIPT_TOOLS.includes(tool)) {
                    result = await executeContentScriptTool(tool, params);
                } else {
                    throw new Error(`Unknown tool: ${tool}`);
                }
                sendResponse({ result });
            } catch (error: any) {
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }
});

console.log('[Background] Extenda Background Service Worker Initialized (Clean Build)');
