/**
 * Notifier Tool - Desktop notifications and user alerts
 */

export interface NotifierParams {
    action: 'notify' | 'confirm' | 'prompt';
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    options?: chrome.notifications.NotificationOptions;
}

export interface NotifierResult {
    success: boolean;
    response?: string | boolean;
    error?: string;
}

export class Notifier {
    /**
     * Show desktop notification
     */
    static async notify(
        title: string,
        message: string,
        type: 'info' | 'success' | 'warning' | 'error' = 'info'
    ): Promise<string> {
        const iconMap = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        const options: chrome.notifications.NotificationOptions = {
            type: 'basic',
            iconUrl: './icon.png', // Update with actual icon path
            title: `${iconMap[type]} ${title}`,
            message,
            priority: type === 'error' ? 2 : type === 'warning' ? 1 : 0
        };

        return new Promise((resolve, reject) => {
            chrome.notifications.create('', options as chrome.notifications.NotificationOptions<true>, (notificationId) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(notificationId);
                }
            });
        });
    }

    /**
     * Show confirmation dialog (Yes/No)
     */
    static async confirm(message: string): Promise<boolean> {
        return confirm(message);
    }

    /**
     * Show prompt dialog (text input)
     */
    static async prompt(message: string, defaultValue?: string): Promise<string | null> {
        return prompt(message, defaultValue);
    }

    /**
     * Execute Notifier action
     */
    static async execute(params: NotifierParams): Promise<NotifierResult> {
        try {
            let response: any;

            switch (params.action) {
                case 'notify':
                    if (!params.title || !params.message) {
                        throw new Error('title and message required for notify');
                    }
                    response = await this.notify(params.title, params.message, params.type);
                    return { success: true, response };

                case 'confirm':
                    if (!params.message) {
                        throw new Error('message required for confirm');
                    }
                    response = await this.confirm(params.message);
                    return { success: true, response };

                case 'prompt':
                    if (!params.message) {
                        throw new Error('message required for prompt');
                    }
                    response = await this.prompt(params.message);
                    return { success: true, response };

                default:
                    throw new Error(`Unknown action: ${params.action}`);
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
