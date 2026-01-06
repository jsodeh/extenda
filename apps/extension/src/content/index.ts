/**
 * Content Script - Main entry point
 * Injected into web pages for DOM manipulation
 */

import { DOMReader, DOMReaderParams } from './dom-reader';
import { GmailScraper } from './gmail-scraper';
import { FormFiller, FormFillerParams } from './form-filler';

console.log('[Extenda] Content script loaded on:', window.location.href);

// Message types
interface ContentScriptMessage {
    type: string;
    action?: string;
    params?: any;
    requestId?: string;
}

interface ContentScriptResponse {
    type: string;
    success: boolean;
    data?: any;
    error?: string;
    requestId?: string;
}

/**
 * Handle messages from background script
 */
chrome.runtime.onMessage.addListener((message: ContentScriptMessage, sender, sendResponse) => {
    console.log('[Extenda] Content script received message:', message);

    // Handle different tool execution requests
    switch (message.type) {
        case 'EXECUTE_DOM_READER':
            handleDOMReader(message.params, message.requestId).then(sendResponse);
            return true; // Keep channel open for async response

        case 'EXECUTE_GMAIL_SCRAPER':
            handleGmailScraper(message.action, message.params, message.requestId).then(sendResponse);
            return true;

        case 'EXECUTE_FORM_FILLER':
            handleFormFiller(message.params, message.requestId).then(sendResponse);
            return true;

        case 'PING':
            sendResponse({ type: 'PONG', success: true });
            return false;

        default:
            sendResponse({
                type: 'ERROR',
                success: false,
                error: `Unknown message type: ${message.type}`,
                requestId: message.requestId
            });
            return false;
    }
});

/**
 * Handle DOMReader execution
 */
async function handleDOMReader(params: DOMReaderParams, requestId?: string): Promise<ContentScriptResponse> {
    try {
        const result = DOMReader.execute(params);
        return {
            type: 'DOM_READER_RESULT',
            success: result.success,
            data: result.data,
            error: result.error,
            requestId
        };
    } catch (error) {
        return {
            type: 'DOM_READER_RESULT',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId
        };
    }
}

/**
 * Handle Gmail scraper execution
 */
async function handleGmailScraper(action?: string, params?: any, requestId?: string): Promise<ContentScriptResponse> {
    try {
        if (!GmailScraper.isGmail()) {
            throw new Error('Not on Gmail');
        }

        let data: any;

        switch (action) {
            case 'get_inbox':
                data = GmailScraper.getInboxEmails(params?.limit || 10);
                break;

            case 'get_open_email':
                data = GmailScraper.getOpenEmail();
                break;

            case 'search':
                if (!params?.query) {
                    throw new Error('Query required for search');
                }
                data = await GmailScraper.searchEmails(params.query);
                break;

            case 'get_unread_count':
                data = { count: GmailScraper.getUnreadCount() };
                break;

            default:
                throw new Error(`Unknown Gmail action: ${action}`);
        }

        return {
            type: 'GMAIL_SCRAPER_RESULT',
            success: true,
            data,
            requestId
        };
    } catch (error) {
        return {
            type: 'GMAIL_SCRAPER_RESULT',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId
        };
    }
}

/**
 * Handle FormFiller execution
 */
async function handleFormFiller(params: FormFillerParams, requestId?: string): Promise<ContentScriptResponse> {
    try {
        const result = FormFiller.execute(params);
        return {
            type: 'FORM_FILLER_RESULT',
            success: result.success,
            data: result.message,
            error: result.error,
            requestId
        };
    } catch (error) {
        return {
            type: 'FORM_FILLER_RESULT',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId
        };
    }
}

/**
 * Notify background script that content script is ready
 */
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', url: window.location.href });

// Export for testing
export { DOMReader, GmailScraper };
