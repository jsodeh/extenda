/**
 * FormFiller Tool - Automate form interactions
 * Runs in content script context
 */

export interface FormFillerParams {
    action: 'fill_text' | 'click' | 'select' | 'submit' | 'fill_form';
    selector?: string;
    value?: string;
    formData?: Record<string, string>;
}

export interface FormFillerResult {
    success: boolean;
    message?: string;
    error?: string;
}

export class FormFiller {
    /**
     * Fill text input or textarea
     */
    static fillText(selector: string, value: string): void {
        const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        element.value = value;

        // Trigger input events for frameworks that listen to them
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Click an element
     */
    static click(selector: string): void {
        const element = document.querySelector(selector) as HTMLElement;
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        element.click();
    }

    /**
     * Select option from dropdown
     */
    static select(selector: string, value: string): void {
        const element = document.querySelector(selector) as HTMLSelectElement;
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Submit form
     */
    static submit(selector: string): void {
        const form = document.querySelector(selector) as HTMLFormElement;
        if (!form) {
            throw new Error(`Form not found: ${selector}`);
        }

        form.submit();
    }

    /**
     * Fill entire form with data
     */
    static fillForm(formData: Record<string, string>): void {
        for (const [selector, value] of Object.entries(formData)) {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn(`Element not found: ${selector}`);
                continue;
            }

            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                this.fillText(selector, value);
            } else if (element instanceof HTMLSelectElement) {
                this.select(selector, value);
            }
        }
    }

    /**
     * Execute FormFiller action
     */
    static execute(params: FormFillerParams): FormFillerResult {
        try {
            switch (params.action) {
                case 'fill_text':
                    if (!params.selector || params.value === undefined) {
                        throw new Error('selector and value required for fill_text');
                    }
                    this.fillText(params.selector, params.value);
                    return { success: true, message: 'Text filled successfully' };

                case 'click':
                    if (!params.selector) {
                        throw new Error('selector required for click');
                    }
                    this.click(params.selector);
                    return { success: true, message: 'Element clicked successfully' };

                case 'select':
                    if (!params.selector || params.value === undefined) {
                        throw new Error('selector and value required for select');
                    }
                    this.select(params.selector, params.value);
                    return { success: true, message: 'Option selected successfully' };

                case 'submit':
                    if (!params.selector) {
                        throw new Error('selector required for submit');
                    }
                    this.submit(params.selector);
                    return { success: true, message: 'Form submitted successfully' };

                case 'fill_form':
                    if (!params.formData) {
                        throw new Error('formData required for fill_form');
                    }
                    this.fillForm(params.formData);
                    return { success: true, message: 'Form filled successfully' };

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
