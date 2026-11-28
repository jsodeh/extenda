import { DOMReader } from '../dom-reader';
import { formIdentity } from '../form-identity';
import { FormFiller, FormFillerParams } from '../form-filler';
async function reviewed(params: FormFillerParams) {
    try {
        const selectors = params.formData ? Object.keys(params.formData) : [params.selector!];
        return FormFiller.execute({...params,reviewedFields:formIdentity(selectors)});
    } catch (e) { return {success:false,error:(e as Error).message}; }
}

test('detects accessible labels, choices and required controls, then fills them', async () => {
    document.body.innerHTML =
        '<form><label>Name<input name="n" required></label><select><option value="ok">Yes</option></select><input type="checkbox"></form>';
    const { data } = DOMReader.execute({ action: 'inspect_form' });
    expect(data[1]).toMatchObject({ label: 'Name', required: true });
    const el = document.querySelector('input')!;
    const changed = jest.fn();
    el.addEventListener('input', changed);
    expect(
        (
            await reviewed({
                action: 'fill_form',
                formData: { [data[1].selector]: 'Fixture', select: 'Yes', '[type=checkbox]': true }
            })
        ).success
    ).toBe(true);
    expect(el.value).toBe('Fixture');
    expect(changed).toHaveBeenCalled();
    expect((await reviewed({ action: 'fill_text', selector: 'textarea', value: 'x' })).success).toBe(
        false
    );
});
test('invalid required answers prevent submission', async () => {
    document.body.innerHTML = '<form><input required></form>';
    const submit = jest.spyOn(HTMLFormElement.prototype, 'requestSubmit');
    expect((await reviewed({ action: 'submit', selector: 'form' })).success).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    submit.mockRestore();
});

test('advances an in-page form and requires a new confirmation message after approved submission', async () => {
    document.body.innerHTML =
        '<form action="/apply"><input name="role" value="Engineer"><button type="button">Next</button></form>';
    document.querySelector('button')!.addEventListener('click', () => {
        document.querySelector('button')!.outerHTML =
            '<label>Name<input name="name" value="Fixture" required></label><button type="submit">Apply</button>';
    });
    expect((await reviewed({ action: 'advance', selector: 'button' })).success).toBe(true);
    const review = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const submit = jest.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {
        document.body.insertAdjacentHTML('beforeend', '<h2>Application received</h2>');
    });
    try {
        expect(await reviewed({ action: 'submit', selector: 'button' })).toMatchObject({
            success: true,
            message: 'Application received'
        });
        expect(review).toHaveBeenCalledWith(expect.stringContaining('/apply'));
        expect(review).toHaveBeenCalledWith(expect.stringContaining('name: Fixture'));
        expect(submit).toHaveBeenCalledTimes(1);
    } finally {
        review.mockRestore();
        submit.mockRestore();
    }
});

test('inspects only visible steps and selects an option from the linked accessible list', async () => {
    document.body.innerHTML = '<form><section style="display:none"><input required></section>' +
        '<button type="button" role="combobox" aria-controls="choices" aria-label="Role">Choose</button>' +
        '<div id="choices" role="listbox"><div role="option">Engineer</div></div></form>';
    const fields = DOMReader.execute({action:'inspect_form'}).data;
    expect(fields.some((f: any) => f.required)).toBe(false);
    expect(fields.find((f:any) => f.type === 'combobox').options[0].label).toBe('Engineer');
    document.querySelector('[role=option]')!.addEventListener('click', e => (e.target as HTMLElement).setAttribute('aria-selected','true'));
    expect((await reviewed({action:'select', selector:'[role=combobox]',value:'Engineer'})).success).toBe(true);
});

test('checks the applied value after a controlled input rerenders and rejects external form actions', async () => {
    document.body.innerHTML = '<form><input name="profile"></form>';
    document.querySelector('input')!.addEventListener('input', () => {
        queueMicrotask(() => { document.querySelector('input')!.value = ''; });
    });
    expect((await reviewed({action:'fill_text',selector:'input',value:'Fixture'})).success).toBe(false);
    document.querySelector('form')!.action='https://other.example.test/apply';
    expect((await reviewed({action:'fill_text',selector:'input',value:'Fixture'})).error).toMatch(/another origin/);
});

test('invalidates pending fill and attachment after same-URL form replacement or a material change', async () => {
    const markup = '<form action="/apply"><label>Name<input name="n"></label><input type="file"></form>';
    document.body.innerHTML = markup;
    const fill = {action:'fill_text' as const,selector:'input[name=n]',value:'Fixture', reviewedFields:formIdentity(['input[name=n]'])};
    const attachment = {action:'attach' as const,selector:'[type=file]',file:{name:'f.txt',type:'text/plain',bytes:[65]},reviewedFields:formIdentity(['[type=file]'])};
    document.body.innerHTML = markup;
    expect((await FormFiller.execute(fill)).success).toBe(false);
    expect((await FormFiller.execute(attachment)).error).toMatch(/approve again/);
    expect(document.querySelector('input')!.value).toBe('');
    fill.reviewedFields=formIdentity([fill.selector]);
    document.querySelector('label')!.firstChild!.textContent='Passcode';
    expect((await FormFiller.execute(fill)).success).toBe(false);
    fill.reviewedFields=formIdentity([fill.selector]);
    document.querySelector('input')!.type='email';
    expect((await FormFiller.execute(fill)).success).toBe(false);
    fill.reviewedFields=formIdentity([fill.selector]);
    document.querySelector('input')!.outerHTML='<input type="email" name="n" value="old">';
    expect((await FormFiller.execute(fill)).success).toBe(true);
});

test('requires manual completion for external actions and associated submitter overrides', async () => {
    document.body.innerHTML = '<form id="application" action="/apply"><input name="n"></form><button form="application" formaction="https://external.example/path">Apply</button>';
    const submit = jest.spyOn(HTMLFormElement.prototype,'requestSubmit');
    try {
        expect((await reviewed({action:'fill_text',selector:'input',value:'x'})).error).toMatch(/another origin/);
        expect((await reviewed({action:'submit',selector:'button'})).error).toMatch(/another origin/);
        document.querySelector('form')!.action='https://external.example/base';
        document.querySelector('button')!.setAttribute('formaction','/local');
        expect((await reviewed({action:'submit',selector:'button'})).error).toMatch(/another origin/);
        expect(submit).not.toHaveBeenCalled();
    } finally { submit.mockRestore(); }
});

test('shows the resolved submitter destination and rechecks target and answers after confirmation', async () => {
    document.body.innerHTML='<form action="/start"><input name="role" value="Engineer"><button formaction="/finish">Apply</button></form>';
    const submit=jest.spyOn(HTMLFormElement.prototype,'requestSubmit');
    const confirm=jest.spyOn(window,'confirm').mockImplementation(()=>{
        document.querySelector('button')!.setAttribute('formaction','/changed');
        return true;
    });
    try {
        expect((await reviewed({action:'submit',selector:'button'})).success).toBe(false);
        expect(confirm).toHaveBeenCalledWith(expect.stringContaining(location.origin+'/finish'));
        confirm.mockImplementation(()=>{document.querySelector('form')!.target='other-frame';return true;});
        expect((await reviewed({action:'submit',selector:'button'})).success).toBe(false);
        expect(submit).not.toHaveBeenCalled();
    } finally {confirm.mockRestore();submit.mockRestore();}
});
