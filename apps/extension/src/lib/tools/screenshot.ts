/**
 * Screenshot Tool - Capture visible tab
 */

export async function captureScreenshot(): Promise<string> {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null as any, {
            format: 'png',
            quality: 90
        });
        return dataUrl;
    } catch (error: any) {
        throw new Error(`Screenshot failed: ${error.message}`);
    }
}

/**
 * Capture screenshot and return as base64 without data URL prefix
 */
export async function captureScreenshotBase64(): Promise<string> {
    const dataUrl = await captureScreenshot();
    // Remove "data:image/png;base64," prefix
    return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}

export interface ScreenshotResult {
    success: boolean;
    dataUrl?: string;
    base64?: string;
    error?: string;
}

export async function handleScreenshot(params: { format?: 'dataUrl' | 'base64' }): Promise<ScreenshotResult> {
    try {
        const dataUrl = await captureScreenshot();

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
