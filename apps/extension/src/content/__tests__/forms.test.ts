import { DOMReader } from '../dom-reader';
import { FormFiller } from '../form-filler';
test('detects accessible labels, choices and required controls, then fills them', async () => {
    document.body.innerHTML='<form><label>Name<input name="n" required></label><select><option value="ok">Yes</option></select><input type="checkbox"></form>';
    const {data}=DOMReader.execute({action:'inspect_form'});
    expect(data[1]).toMatchObject({label:'Name',required:true});
    const el=document.querySelector('input')!;
    const changed=jest.fn(); el.addEventListener('input',changed);
    expect((await FormFiller.execute({action:'fill_form',formData:{[data[1].selector]:'Fixture',select:'Yes','[type=checkbox]':true}})).success).toBe(true);
    expect(el.value).toBe('Fixture'); expect(changed).toHaveBeenCalled();
    expect((await FormFiller.execute({action:'fill_text',selector:'textarea',value:'x'})).success).toBe(false);
});
test('invalid required answers prevent submission',async()=>{
    document.body.innerHTML='<form><input required></form>';
    const submit=jest.spyOn(HTMLFormElement.prototype,'requestSubmit');
    expect((await FormFiller.execute({action:'submit',selector:'form'})).success).toBe(false);
    expect(submit).not.toHaveBeenCalled(); submit.mockRestore();
});
