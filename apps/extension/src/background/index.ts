import { wsClient } from '../lib/websocket';
import { handleTabManager } from '../lib/tools/tab-manager';
import { EVENTS_SERVER, EVENTS_CLIENT, ToolExecutionRequest } from '@extenda/shared';

// Initialize connection with auth
const initConnection = () => {
    chrome.storage.local.get(['accessToken'], (result) => {
        const token = result.accessToken;
        if (token) {
            console.log('Background connecting with token');
            wsClient.connect(token);
        } else {
            console.log('Background waiting for token');
        }
    });
};

initConnection();

// Listen for token changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.accessToken) {
        const newToken = changes.accessToken.newValue;
        if (newToken) {
            console.log('Token updated, reconnecting');
            wsClient.connect(newToken);
        } else {
            console.log('Token removed, disconnecting');
            wsClient.disconnect();
        }
    }
});

wsClient.on('connect', () => {
    console.log('Background worker connected to API');
});

// Tool Execution Dispatcher
const handleToolExecution = async (data: ToolExecutionRequest) => {
    console.log('Received tool execution request:', data);
    const { executionId, stepId, tool, params } = data;

    try {
        let result;
        if (tool === 'TabManager') {
            result = await handleTabManager(params);
        } else if (tool === 'Notifier') {
            // Basic notification implementation
            console.log('Processing Notifier request:', params);
            if (params.action === 'notify') {
                try {
                    const notificationId = await chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icon-128.png',
                        title: params.title || 'Extenda',
                        message: params.message
                    });
                    console.log('Notification created:', notificationId);
                    result = { success: true, notificationId };
                } catch (err) {
                    console.error('Chrome notification failed:', err);
                    // Fallback to purely success=true so we don't break flow if notifications are disabled/failed
                    // But still log error
                    result = { success: true, warning: 'Notification API failed, but step assumed complete.' };
                }
            } else {
                // TODO: Implement confirm/prompt if needed using sidepanel messaging or popup
                throw new Error(`Notifier action ${params.action} not yet implemented`);
            }
        } else {
            throw new Error(`Unknown client tool: ${tool}`);
        }

        // Send success result
        wsClient.emit('tool:result', {
            executionId,
            stepId,
            status: 'success',
            result
        });

    } catch (error: any) {
        console.error('Tool execution failed:', error);
        // Send error result
        wsClient.emit('tool:result', {
            executionId,
            stepId,
            status: 'error',
            error: error.message
        });
    }
};

wsClient.on('tool:execute', handleToolExecution);

// Listen for tab updates to track context
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        console.log('Active tab changed:', tab.url);
    } catch (e) {
        console.error('Error getting active tab:', e);
    }
});

// Setup side panel behavior
// Check if sidePanel API is available (it should be in Manifest V3)
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));
}

console.log('Extenda Background Service Worker Initialized');
