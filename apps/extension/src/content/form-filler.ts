import { DOMReader } from './dom-reader';
export interface FormFillerParams {
    action: 'fill_text' | 'click' | 'select' | 'submit' | 'fill_form' | 'attach' | 'advance';
    selector?: string;
    value?: string;
    formData?: Record<string, string | boolean>;
    file?: { name: string; type: string; bytes: number[] };
}

function field(selector: string) {
    const matches = document.querySelectorAll<HTMLElement>(selector);
    if (matches.length !== 1 || matches[0].matches(':disabled,[readonly],[hidden],input[type=hidden]')) {
        throw new Error('Field unavailable or ambiguous. Review the current page.');
    }
    return matches[0];
}

function reviewableForm(form: HTMLFormElement) {
    if (
        form.querySelector(
            'input[type=password],input[autocomplete=one-time-code],iframe[src*=captcha i],[name*=captcha i]'
        )
    ) {
        throw new Error('Complete the verification on the page manually');
    }
}

export class FormFiller {
    static fillText(selector: string, value: string | boolean) {
        const el = field(selector);
        if (
            (el instanceof HTMLInputElement &&
                ['password', 'hidden', 'file', 'button', 'submit', 'reset', 'image'].includes(el.type)) ||
            el.matches('[autocomplete="one-time-code"]')
        )
            throw new Error('This field requires manual completion');
        if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) {
            if (typeof value !== 'boolean' && !['true', 'false', el.value].includes(value))
                throw new Error('Invalid choice');
            const checked = value === true || value === 'true' || value === el.value;
            if (el.checked !== checked) el.click();
            if (el.checked !== checked) throw new Error('Choice was not applied');
            return;
        }
        if (el instanceof HTMLSelectElement) {
            const option = Array.from(el.options).find(
                (o) => !o.disabled && (o.value === value || o.text === value)
            );
            if (!option) throw new Error('Option unavailable');
            el.value = option.value;
        } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
            const proto =
                el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
            Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, String(value));
            if (el.value !== String(value)) throw new Error('Value rejected by field');
        } else if (el.isContentEditable || el.getAttribute('contenteditable') === 'true')
            el.textContent = String(value);
        else throw new Error('Unsupported field');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    static async submit(selector: string) {
        const el = field(selector);
        const form = el instanceof HTMLFormElement ? el : el.closest('form');
        if (!form) throw new Error('Select a standard form to submit');
        reviewableForm(form);
        if (!form.reportValidity()) throw new Error('Resolve the highlighted validation errors before submission');
        const submitter = el instanceof HTMLButtonElement || el instanceof HTMLInputElement ? el : undefined;
        const dest = submitter?.hasAttribute('formaction') ? submitter.formAction : form.action;
        if (!/^https?:\/\//.test(dest)) throw new Error('Unsupported form destination');
        const values = Array.from(new FormData(form, submitter).entries())
            .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : v.name}`)
            .join('\n');
        if (!window.confirm(`Submit these current answers to ${dest}?\n\n${values}`))
            throw new Error('Submission declined');
        const confirmation = () =>
            Array.from(document.querySelectorAll('[role=status],[role=alert],h1,h2,.confirmation'))
                .map((e) => e.textContent?.trim() || '')
                .filter((t) =>
                    /successfully submitted|application (?:was |has been )?(?:received|submitted)|thank you for (?:applying|your submission)/i.test(
                        t
                    )
                );
        const before = new Set(confirmation());
        form.requestSubmit(submitter);
        for (let i = 0; i < 16; i++) {
            const receipt = confirmation().find((t) => !before.has(t));
            if (receipt) return receipt;
            await new Promise((r) => setTimeout(r, 250));
        }
        throw new Error(
            'Submission was requested. No confirmation observed. Check the site before taking further action.'
        );
    }

    static async execute(params: FormFillerParams) {
        try {
            const { action, selector } = params;
            if (action === 'advance' && selector) {
                const button = field(selector);
                if (
                    !(button instanceof HTMLButtonElement) ||
                    button.type !== 'button' ||
                    !/^(next|continue)( step)?$/i.test(
                        (button.getAttribute('aria-label') || button.textContent || '').trim()
                    )
                )
                    throw new Error('Advance this page manually, then ask Extenda to continue');
                const form = button.closest('form');
                if (form) reviewableForm(form);
                const before = JSON.stringify(DOMReader.execute({ action: 'inspect_form' }).data);
                button.click();
                for (let i = 0; i < 15; i++) {
                    await new Promise((r) => setTimeout(r, 200));
                    const result = DOMReader.execute({ action: 'inspect_form' });
                    if (result.success && JSON.stringify(result.data) !== before)
                        return { success: true, message: result.data };
                }
                throw new Error('Next step could not be verified. Check the page before continuing.');
            } else if (action === 'fill_form' && params.formData) {
                for (const [key, value] of Object.entries(params.formData)) this.fillText(key, value);
            } else if ((action === 'fill_text' || action === 'select') && selector && params.value !== undefined) {
                this.fillText(selector, params.value);
            } else if (action === 'submit' && selector)
                return { success: true, message: await this.submit(selector) };
            else if (action === 'click' && selector) {
                const el = field(selector);
                if (el.closest('form') || el.matches('[form]'))
                    throw new Error('Review and use submit for form submission, or advance the page manually');
                el.click();
            } else if (action === 'attach' && selector && params.file) {
                const el = field(selector);
                if (!(el instanceof HTMLInputElement) || el.type !== 'file')
                    throw new Error('Select the file manually');
                const transfer = new DataTransfer();
                transfer.items.add(
                    new File([new Uint8Array(params.file.bytes)], params.file.name, { type: params.file.type })
                );
                el.files = transfer.files;
                el.dispatchEvent(new Event('change', { bubbles: true }));
                if (!el.files?.length) throw new Error('Use the website file picker');
            } else throw new Error('Missing or unsupported form parameters');
            const missing = Array.from(
                document.querySelectorAll<HTMLInputElement>('input:invalid,textarea:invalid,select:invalid')
            ).map((el) => el.labels?.[0]?.textContent || el.name || el.id);
            return {
                success: true,
                message: missing.length
                    ? 'Applied. Review required fields: ' + missing.join(', ')
                    : 'Applied. Review the answers on the page.'
            };
        } catch (e) {
            return { success: false, error: (e as Error).message };
        }
    }
}
