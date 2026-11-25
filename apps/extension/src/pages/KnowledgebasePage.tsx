import { privateRequest } from '../lib/api';
import { useEffect, useState } from 'react';
import { ArrowLeft, Upload, FileText, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

interface Document {
    id: string;
    name: string;
    size: number;
    uploadedAt: string;
    hasOriginal: boolean;
    metadata?: { facts?: string; tags?: string; error?: string; semantic?: boolean };
    status: 'processing' | 'ready' | 'failed';
}

interface KnowledgebasePageProps {
    onBack?: () => void;
}

export default function KnowledgebasePage({ onBack }: KnowledgebasePageProps) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const base = '/api/knowledge';
    const [error, setError] = useState('');
    const [query,setQuery] = useState('');
    const [matches,setMatches] = useState<string[]>([]);
    const [progress,setProgress] = useState('');
    const [semantic,setSemantic] = useState(false);
    const [preview,setPreview] = useState('');
    const [editing,setEditing] = useState<Document | null>(null);
    const [facts,setFacts] = useState('');
    const [tags,setTags] = useState('');
    const refresh = async () => setDocuments(await (await privateRequest(base)).json());
    const act = async (operation: () => Promise<void>) => {
        setError('');
        try { await operation(); } catch (e) { setError((e as Error).message); }
    };
    useEffect(() => { void act(refresh); }, []);
    const handleFileUpload = async (files: FileList | null, replace?: string) => {
        if (!files?.length || uploading) return;
        setUploading(true);
        const selected = Array.from(files);
        const errors: string[] = [];
        for (const [index,file] of selected.entries()) {
            setProgress(`Processing ${index+1} of ${selected.length}: ${file.name}`);
            const data = new FormData();
            data.append('file',file);
            data.append('semantic',String(semantic));
            if (replace) data.append('replace',replace);
            try { await privateRequest(base+'/upload',{ method:'POST',body:data }); }
            catch (e) { errors.push(`${file.name}: ${(e as Error).message}`); }
        }
        await act(refresh);
        setError(errors.join(' · ')); setProgress(''); setUploading(false);
    };
    const inspect = (doc: Document) => act(async () => {
        const sections = await (await privateRequest(`${base}/${doc.id}/preview`)).json();
        setPreview(sections.map((s:any) => s.content).join('\n\n'));
        setFacts(doc.metadata?.facts || ''); setTags(doc.metadata?.tags || ''); setEditing(doc);
    });
    const download = (doc: Document) => act(async () => {
        const url = URL.createObjectURL(await (await privateRequest(`${base}/${doc.id}/download`)).blob());
        const a = document.createElement('a'); a.href=url; a.download=doc.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url),1000);
    });
    const handleDelete = (id: string) => act(async () => {
        if (!window.confirm('Delete this original and its indexed text and profile facts?')) return;
        await privateRequest(`${base}/${id}`,{method:'DELETE'}); setEditing(null); setMatches([]); await refresh();
    });

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card px-6 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors"
                            title="Back"
                        >
                            <ArrowLeft className="h-6 w-6 text-foreground" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Knowledgebase</h1>
                        <p className="text-xs text-muted-foreground mt-1">
                            Upload documents to enhance AI responses with your data
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-4xl mx-auto space-y-4">
                    {/* Upload Area */}
                    <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card'
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            Upload Documents
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Drag and drop or click to browse
                        </p>
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            multiple accept=".pdf,.txt,.md,.markdown,.docx,.csv,.json"
                            onChange={(e) => handleFileUpload(e.target.files)}
                            disabled={uploading}
                        />
                        <label
                            htmlFor="file-upload"
                            className={`inline-block px-6 py-2 bg-primary text-primary-foreground rounded-xl font-medium cursor-pointer transition-all ${uploading
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:opacity-90 active:scale-95'
                                }`}
                        >
                            {uploading ? progress : 'Choose Files'}
                        </label>
                        <p className="text-[10px] text-muted-foreground mt-3">
                            Supported: PDF, DOCX, TXT, Markdown, CSV and JSON (10 MB each)
                        </p>
                    </div>

                    <label className="block text-xs"><input type="checkbox" checked={semantic} onChange={e=>setSemantic(e.target.checked)} /> Send chunks to OpenAI for semantic indexing</label>
                    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
                    <form className="flex gap-2" onSubmit={e=>{ e.preventDefault(); void act(async()=>setMatches(await (await privateRequest(base+'/search?q='+encodeURIComponent(query))).json())); }}>
                        <input className="flex-1 bg-card border rounded p-2" placeholder="Search document contents" aria-label="Search documents" value={query} onChange={e=>setQuery(e.target.value)} />
                        <button>Search</button>
                    </form>
                    {matches.map((m,i)=><p className="text-xs whitespace-pre-wrap" key={i}>{m}</p>)}
                    {editing && <section className="bg-card rounded-xl border p-4 space-y-2">
                        <button className="float-right" onClick={()=>setEditing(null)}>Close</button><strong>{editing.name}</strong>
                        <pre className="whitespace-pre-wrap max-h-48 overflow-auto text-xs">{preview}</pre>
                        <label className="block">Confirmed profile facts<textarea className="w-full border bg-background p-2" value={facts} onChange={e=>setFacts(e.target.value)} /></label>
                        <label>Tags <input className="border bg-background" value={tags} onChange={e=>setTags(e.target.value)} /></label>
                        <button className="block text-primary" onClick={()=>act(async()=>{
                            const prefs=await chrome.storage.local.get(['extenda_active_provider','extenda_provider_keys','extenda_default_models','extenda_ollama_url']);
                            const provider=prefs.extenda_active_provider || 'google';
                            if (!confirm('Send excerpts from this document to your selected AI provider for profile suggestions?')) return;
                            const res=await privateRequest(`${base}/${editing.id}/suggest`,{method:'POST',headers:{'Content-Type':'application/json'},
                                body:JSON.stringify({modelConfig:{provider,model:prefs.extenda_default_models?.[provider],apiKey:prefs.extenda_provider_keys?.[provider],baseURL:prefs.extenda_ollama_url}})});
                            setFacts((await res.json()).facts);
                        })}>Suggest facts for review</button>
                        <button className="text-primary" onClick={()=>act(async()=>{
                            await privateRequest(`${base}/${editing.id}/profile`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({facts,tags})});
                            setEditing(null); await refresh();
                        })}>Save confirmed facts and tags</button>
                    </section>}
                    {/* Documents List */}
                    {documents.length > 0 && (
                        <div>
                            <h2 className="text-base font-semibold text-foreground mb-3">
                                Your Documents ({documents.length})
                            </h2>
                            <div className="space-y-2">
                                {documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="bg-card rounded-xl border border-border p-4 flex items-center justify-between hover:border-primary/20 transition-all"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-foreground truncate">
                                                    {doc.name}
                                                </h3>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                    <span>{formatFileSize(doc.size)}</span>
                                                    <span>•</span>
                                                    <span>
                                                        {new Date(doc.uploadedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Status */}
                                            {doc.status === 'processing' && (
                                                <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-xs font-medium">
                                                    Processing...
                                                </span>
                                            )}
                                            {doc.status === 'ready' && (
                                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                                            )}
                                            {doc.status === 'failed' && (
                                                <AlertCircle className="h-5 w-5 text-destructive" />
                                            )}

                                            <div className="flex flex-col text-xs text-primary">
                                                <button onClick={()=>inspect(doc)}>Preview / profile</button>
                                                {doc.hasOriginal && <button onClick={()=>download(doc)}>Download</button>}
                                                {doc.status !== 'ready' && <button title={doc.metadata?.error} onClick={()=>act(async()=>{await privateRequest(`${base}/${doc.id}/retry`,{method:'POST'}); await refresh();})}>Retry processing</button>}
                                                <label className="cursor-pointer">Replace<input type="file" className="hidden" onChange={e=>{if(confirm('Replace this document and its saved facts?')) void handleFileUpload(e.target.files,doc.id);}} /></label>
                                            </div>
                                            {/* Delete */}
                                            <button
                                                onClick={() => handleDelete(doc.id)}
                                                className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                                                title="Delete document"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Info */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <h3 className="font-semibold text-foreground mb-2">
                            How it works
                        </h3>
                        <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Upload your documents (contracts, guides, notes)</li>
                            <li>• AI will automatically process and index them</li>
                            <li>• Ask questions and get answers based on your data</li>
                            <li>• Documents are securely stored and only accessible to you</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
