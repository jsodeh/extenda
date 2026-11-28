// Form mounts survive controlled input rerenders. A replacement form gets its own review.
const mounts = new WeakMap<Element, string>();

export function owningForm(el: HTMLElement): HTMLFormElement | null {
    return el instanceof HTMLFormElement ? el : (el as HTMLInputElement).form || el.closest('form');
}

function destination(value: string | null) {
    const url = new URL(value || location.href, document.baseURI);
    if (
        !['https:', 'http:'].includes(url.protocol) ||
        url.origin !== location.origin ||
        url.username ||
        url.password
    )
        throw new Error('This form sends data to another origin. Complete it manually.');
    return url.href;
}

export function formDestination(form: HTMLFormElement, submitter?: HTMLElement) {
    const action = destination(form.getAttribute('action'));
    return submitter?.hasAttribute('formaction') ? destination(submitter.getAttribute('formaction')) : action;
}

function label(el: HTMLElement) {
    const labels = Array.from((el as HTMLInputElement).labels || [], (node) => {
        const copy = node.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('input,textarea,select,button,[contenteditable]').forEach((control) =>
            control.remove()
        );
        return copy.textContent;
    });
    const labelledBy = (el.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent);
    return (
        el.getAttribute('aria-label') ||
        labelledBy.join(' ').trim() ||
        labels.join(' ').trim() ||
        el.getAttribute('placeholder') ||
        (el.matches('button') ? el.textContent : '') ||
        el.getAttribute('name') ||
        ''
    )
        .replace(/\s+/g, ' ')
        .trim();
}

export function formIdentity(selectors: string[]) {
    if (!Array.isArray(selectors) || !selectors.length || selectors.length > 150)
        throw new Error('Inspect the intended form fields first');
    return [...new Set(selectors)].sort().map((selector) => {
        const matches = document.querySelectorAll<HTMLElement>(selector);
        if (matches.length !== 1) throw new Error('Field unavailable or ambiguous. Review the current form.');
        const el = matches[0],
            form = owningForm(el),
            owner = form || document.body;
        if (!mounts.has(owner))
            mounts.set(owner, Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'));
        const controls = form ? Array.from(form.elements) : [];
        // Include submitters outside the form associated by form="id", including image inputs.
        const target =
            form?.getAttribute('target') ??
            document.querySelector('base[target]')?.getAttribute('target') ??
            '_self';
        const overrides = form
            ? Array.from(
                  document.querySelectorAll<HTMLElement>(
                      'button[formaction],input[formaction],button[formtarget],input[formtarget],button[formmethod],input[formmethod]'
                  )
              )
                  .filter((button) => owningForm(button) === form)
                  .map((button) => [
                      formDestination(form, button),
                      button.getAttribute('formtarget') ?? target,
                      button.getAttribute('formmethod') ?? form.getAttribute('method') ?? 'get'
                  ])
                  .sort()
            : [];
        return {
            selector,
            mount: mounts.get(owner)!,
            form: label(owner),
            name: el.getAttribute('name') || '',
            label: label(el),
            type: el.getAttribute('role') || (el as HTMLInputElement).type || el.tagName,
            tag: el.tagName,
            inputType: el.getAttribute('type') || '',
            accept: el.getAttribute('accept') || '',
            options:
                el instanceof HTMLSelectElement
                    ? Array.from(el.options, (o) => [o.value, o.label, o.disabled])
                    : [],
            required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
            choice: el.matches('[type=radio],[type=checkbox]') ? (el as HTMLInputElement).value : '',
            destination: form ? formDestination(form, el) : location.href,
            target,
            method: form?.getAttribute('method') || 'get',
            overrides,
            fields: el.matches('form,button[type=submit],button:not([type]),input[type=submit],input[type=image]')
                ? controls
                      .filter((c) => !c.matches('input[type=hidden],button'))
                      .map((c) => [c.getAttribute('name'), label(c as HTMLElement), (c as HTMLInputElement).type])
                : []
        };
    });
}

export function verifyFormIdentity(selectors: string[], expected?: ReturnType<typeof formIdentity>) {
    const current = formIdentity(selectors);
    if (
        !Array.isArray(expected) ||
        current.length !== expected.length ||
        current.some((row, i) =>
            Object.entries(row).some(
                ([key, value]) => JSON.stringify(value) !== JSON.stringify(expected[i]?.[key as keyof typeof row])
            )
        )
    )
        throw new Error('The reviewed form or field changed. Inspect it and approve again.');
}
