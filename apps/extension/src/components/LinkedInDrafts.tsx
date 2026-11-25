import { useEffect, useState } from 'react';
import { privateRequest } from '../lib/api';

interface Draft { id:string; text:string; visibility:string; link?:string; version:number; status?:string; result?:{postUrl?:string;message?:string} }

export default function LinkedInDrafts() {
    const [drafts,setDrafts]=useState<Draft[]>([]);
    const [author,setAuthor]=useState('');
    const [error,setError]=useState('');
    const [editing,setEditing]=useState<Draft|null>(null);
    const [at,setAt]=useState('');
    const refresh=async()=>{
        const data=await (await privateRequest('/api/linkedin')).json();
        setDrafts(data.drafts);setAuthor(data.author || '');
    };
    useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
    const save=async(draft:Draft,approve:boolean)=>{
        try {
            const time=at ? new Date(at).toISOString() : null;
            if (approve && !confirm(`Publish to ${author}, ${draft.visibility}, ${time || 'now'}?\n\n${draft.text}\n${draft.link || ''}`)) return;
            const res=await privateRequest('/api/linkedin/'+draft.id+(approve?'/approve':''),{
                method:approve?'POST':'PUT',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({...draft,author,at:time,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})
            });
            const data=await res.json();
            setError(data.result?.message || data.status || 'Saved');setEditing(null);await refresh();
        } catch(e){setError((e as Error).message);}
    };
    return <section className="text-sm space-y-2 mb-4"><h4 className="font-semibold">LinkedIn drafts</h4>
        {!author && <p>Connect an account with publishing permission, or copy a draft to LinkedIn.</p>}
        {error && <p role="status">{error}</p>}
        {drafts.map(d=><div className="p-3 border rounded-xl space-y-2" key={d.id}>
            {editing?.id===d.id ? <>
                <textarea aria-label="Post text" className="w-full bg-background" rows={5} value={editing.text} onChange={e=>setEditing({...editing,text:e.target.value})}/>
                <select aria-label="Visibility" value={editing.visibility} onChange={e=>setEditing({...editing,visibility:e.target.value})}><option>PUBLIC</option><option>CONNECTIONS</option></select>
                <input aria-label="Optional link" value={editing.link||''} onChange={e=>setEditing({...editing,link:e.target.value})}/>
                <button onClick={()=>save(editing,false)}>Save changes</button>
            </> : <><p className="whitespace-pre-wrap">{d.text}</p>{d.link && <p>{d.link}</p>}<p>{d.visibility} · {d.status || 'draft'}</p>
                <button className="mr-2" onClick={()=>setEditing(d)}>Edit</button>
                <button onClick={()=>navigator.clipboard.writeText([d.text,d.link].filter(Boolean).join('\n')).catch(()=>setError('Select and copy the draft text manually'))}>Copy for manual publishing</button>
                {author && !d.status && <div><input aria-label="Publication time (local, optional)" type="datetime-local" value={at} onChange={e=>setAt(e.target.value)}/>
                    <button onClick={()=>save(d,true)}>{at?'Review schedule':'Review publication'}</button></div>}
                {d.result?.postUrl && <a href={d.result.postUrl} target="_blank" rel="noreferrer">Published post</a>}
            </>}
        </div>)}
    </section>;
}
