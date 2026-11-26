import { DOMReader } from '../dom-reader';
import { FormFiller } from '../form-filler';
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
            await FormFiller.execute({
                action: 'fill_form',
                formData: { [data[1].selector]: 'Fixture', select: 'Yes', '[type=checkbox]': true }
            })
        ).success
    ).toBe(true);
    expect(el.value).toBe('Fixture');
    expect(changed).toHaveBeenCalled();
    expect((await FormFiller.execute({ action: 'fill_text', selector: 'textarea', value: 'x' })).success).toBe(
        false
    );
});
test('invalid required answers prevent submission', async () => {
    document.body.innerHTML = '<form><input required></form>';
    const submit = jest.spyOn(HTMLFormElement.prototype, 'requestSubmit');
    expect((await FormFiller.execute({ action: 'submit', selector: 'form' })).success).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    submit.mockRestore();
});

test('advances an in-page form and requires a new confirmation message after approved submission', async () => {
    document.body.innerHTML =
        '<form action="https://example.test/apply"><input name="role" value="Engineer"><button type="button">Next</button></form>';
    document.querySelector('button')!.addEventListener('click', () => {
        document.querySelector('button')!.outerHTML =
            '<label>Name<input name="name" value="Fixture" required></label><button type="submit">Apply</button>';
    });
    expect((await FormFiller.execute({ action: 'advance', selector: 'button' })).success).toBe(true);
    const review = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const submit = jest.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {
        document.body.insertAdjacentHTML('beforeend', '<h2>Application received</h2>');
    });
    try {
        expect(await FormFiller.execute({ action: 'submit', selector: 'button' })).toMatchObject({
            success: true,
            message: 'Application received'
        });
        expect(review).toHaveBeenCalledWith(expect.stringContaining('https://example.test/apply'));
        expect(review).toHaveBeenCalledWith(expect.stringContaining('name: Fixture'));
        expect(submit).toHaveBeenCalledTimes(1);
    } finally {
        review.mockRestore();
        submit.mockRestore();
    }
});
