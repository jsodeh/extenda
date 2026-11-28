/**
 * Screenshot Tool - Capture visible tab
 */

export interface BrowserTarget { tabId?: number; targetUrl?: string }
export async function assertVisible(target: BrowserTarget) {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if (!target.tabId || tab?.id !== target.tabId || tab.url !== target.targetUrl) throw new Error('Target tab changed. Review the intended page.');
    return tab;
}
export async function captureScreenshot(target: BrowserTarget): Promise<string> {
    try {
        const tab=await assertVisible(target);
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'png',
            quality: 90
        });
        await assertVisible(target);
        return dataUrl;
    } catch (error: any) {
        throw new Error(`Screenshot failed: ${error.message}`);
    }
}

/**
 * Capture screenshot and return as base64 without data URL prefix
 */
export async function captureScreenshotBase64(target: BrowserTarget): Promise<string> {
    const dataUrl = await captureScreenshot(target);
    // Remove "data:image/png;base64," prefix
    return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}

export interface ScreenshotResult {
    success: boolean;
    dataUrl?: string;
    base64?: string;
    error?: string;
}

export async function handleScreenshot(params: BrowserTarget & { format?: 'dataUrl' | 'base64' }): Promise<ScreenshotResult> {
    try {
        const dataUrl = await captureScreenshot(params);

        if (params.format === 'base64') {
            return {
                success: true,
                base64: dataUrl.replace(/^data:image\/\w+;base64,/, '')
            };
        }

        return {
            success: true,
            dataUrl
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
}
