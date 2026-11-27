import { getApiUrl } from '../api';
/**
 * Smart Click Tool - Vision-based element clicking
 * Uses Gemini Vision to identify elements from descriptions
 */

import { assertVisible, BrowserTarget, captureScreenshotBase64 } from './screenshot';

export interface SmartClickParams extends BrowserTarget {
    description: string;  // Natural language element description
    action?: 'click' | 'hover' | 'identify';  // Default: click
}

export interface ElementLocation {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    description: string;
}

export interface SmartClickResult {
    success: boolean;
    element?: ElementLocation;
    message?: string;
    error?: string;
}

/**
 * Click at specific coordinates using content script
 */
async function clickAtCoordinates(tabId: number, x: number, y: number,targetUrl?: string): Promise<void> {
    const response=await chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_CLICK_AT_COORDINATES',
        params: { x, y, targetUrl }
    });
    if (!response?.success) throw new Error(response?.error || 'Click unavailable');
}

/**
 * Send screenshot to API for element identification
 */
async function identifyElementFromScreenshot(
    screenshot: string,
    description: string
): Promise<ElementLocation | null> {
    // Get API URL from storage or use default
    const apiUrl=await getApiUrl();

    const { accessToken } = await chrome.storage.local.get('accessToken');

    const response = await fetch(`${apiUrl}/vision/identify-element`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            screenshot,  // base64 PNG
            description
        })
    });

    if (!response.ok) {
        throw new Error(`Vision API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.element || null;
}

/**
 * Main smart click handler
 */
export async function handleSmartClick(params: SmartClickParams): Promise<SmartClickResult> {
    try {


        // 1. Capture screenshot
        const screenshot = await captureScreenshotBase64(params);
        console.log('[SmartClick] Screenshot captured');

        // 2. Send to vision API for element identification
        const element = await identifyElementFromScreenshot(screenshot, params.description);

        if (!element) {
            return {
                success: false,
                error: `Could not find element matching: "${params.description}"`
            };
        }



        // 3. Perform action
        if (params.action === 'identify') {
            return {
                success: true,
                element,
                message: `Found "${params.description}" at (${element.x}, ${element.y})`
            };
        }

        // Default: click
        const tab = await assertVisible(params);
        if (!tab?.id) {
            throw new Error('No active tab');
        }

        await clickAtCoordinates(tab.id, element.x, element.y,params.targetUrl);

        return {
            success: true,
            element,
            message: `Clicked "${params.description}" at (${element.x}, ${element.y})`
        };

    } catch (error: any) {
        console.error('[SmartClick] Failed');
        return {
            success: false,
            error: error.message
        };
    }
}
