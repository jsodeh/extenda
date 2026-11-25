/**
 * DOMReader Tool - Extract content from web pages
 * Executed in content script context
 */

export interface DOMReaderParams {
    action: 'inspect_form' | 'extract_text' | 'extract_structured' | 'find_element' | 'get_metadata' | 'screenshot';
    selector?: string;
    schema?: Record<string, string>; // CSS selectors for structured extraction
    description?: string; // Natural language element description
}

export interface DOMReaderResult {
    success: boolean;
    data?: any;
    error?: string;
}

export class DOMReader {
    /**
     * Extract all text content from page or specific selector
     */
    static extractText(selector?: string): string {
        const element = selector ? document.querySelector(selector) : document.body;
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }
        return (element as HTMLElement).innerText || element.textContent || '';
    }

    /**
     * Extract structured data using CSS selectors
     * Example: { title: 'h1', author: '.author-name', date: 'time' }
     */
    static extractStructured(schema: Record<string, string>): Record<string, any> {
        const result: Record<string, any> = {};

        for (const [key, selector] of Object.entries(schema)) {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) {
                result[key] = null;
            } else if (elements.length === 1) {
                result[key] = elements[0].textContent?.trim() || null;
            } else {
                result[key] = Array.from(elements).map(el => el.textContent?.trim());
            }
        }

        return result;
    }

    /**
     * Find element by natural language description (simplified - could use AI in future)
     */
    static findElement(description: string): Element | null {
        // Simplified matching - match by text content, aria-label, or placeholder
        const elements = document.querySelectorAll('button, a, input, textarea, [role="button"]');

        for (const element of elements) {
            const text = element.textContent?.toLowerCase() || '';
            const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
            const placeholder = (element as HTMLInputElement).placeholder?.toLowerCase() || '';
            const desc = description.toLowerCase();

            if (text.includes(desc) || ariaLabel.includes(desc) || placeholder.includes(desc)) {
                return element;
            }
        }

        return null;
    }

    /**
     * Get page metadata
     */
    static getMetadata(): Record<string, string> {
        return {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
            description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            author: document.querySelector('meta[name="author"]')?.getAttribute('content') || '',
            keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
        };
    }

    /**
     * Wait for element to appear in DOM
     */
    static async waitForElement(selector: string, timeout: number = 5000): Promise<Element> {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    clearTimeout(timeoutId);
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element not found after ${timeout}ms: ${selector}`));
            }, timeout);
        });
    }

    /**
     * Execute DOMReader action
     */
    static execute(params: DOMReaderParams): DOMReaderResult {
        try {
            let data: any;

            switch (params.action) {
                case 'inspect_form':
                    data = Array.from(document.querySelectorAll<HTMLElement>('form,input:not([type=hidden]),select,textarea,button,[contenteditable=true],[role=alert]')).slice(0,150).map(el => {
                        const control = el as HTMLInputElement;
                        const labelIds = (el.getAttribute('aria-labelledby') || '').split(/\s+/);
                        return {
                            selector: this.getSelector(el), type: control.type || el.tagName.toLowerCase(),
                            label: el.getAttribute('aria-label') || labelIds.map(id=>document.getElementById(id)?.textContent).filter(Boolean).join(' ') ||
                                control.labels?.[0]?.textContent || control.placeholder || control.name || (el.matches('button,[role=alert]') ? el.textContent : ''),
                            required: control.required || el.getAttribute('aria-required') === 'true',
                            validation: control.validationMessage, choice: ['checkbox','radio'].includes(control.type) ? control.value : undefined,
                            options: el instanceof HTMLSelectElement ? Array.from(el.options).map(o=>({label:o.text,value:o.value})) : undefined
                        };
                    });
                    break;
                case 'extract_text':
                    data = this.extractText(params.selector);
                    break;

                case 'extract_structured':
                    if (!params.schema) {
                        throw new Error('Schema required for structured extraction');
                    }
                    data = this.extractStructured(params.schema);
                    break;

                case 'find_element':
                    if (!params.description) {
                        throw new Error('Description required for finding element');
                    }
                    const element = this.findElement(params.description);
                    data = element ? {
                        tagName: element.tagName,
                        text: element.textContent?.trim(),
                        id: element.id,
                        className: element.className,
                        selector: this.getSelector(element)
                    } : null;
                    break;

                case 'get_metadata':
                    data = this.getMetadata();
                    break;

                default:
                    throw new Error(`Unknown action: ${params.action}`);
            }

            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate CSS selector for element
     */
    private static getSelector(element: Element): string {
        if (element.id && document.querySelectorAll('#'+CSS.escape(element.id)).length === 1) return '#'+CSS.escape(element.id);
        const path: string[] = [];
        let current: Element | null = element;
        while (current && current !== document.body) {
            const index = Array.from(current.parentElement?.children || []).indexOf(current)+1;
            path.unshift(current.tagName.toLowerCase()+':nth-child('+index+')');
            current=current.parentElement;
        }
        return ['body',...path].join(' > ');
    }
}
