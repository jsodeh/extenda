import { useState } from 'react';
import { ArrowLeft, Upload, FileText, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

interface Document {
    id: string;
    name: string;
    size: number;
    uploadedAt: Date;
    status: 'processing' | 'ready' | 'failed';
}

interface KnowledgebasePageProps {
    onBack?: () => void;
}

export default function KnowledgebasePage({ onBack }: KnowledgebasePageProps) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        const file = files[0];

        // Mock upload - replace with actual API call
        const newDoc: Document = {
            id: `doc-${Date.now()}`,
            name: file.name,
            size: file.size,
            uploadedAt: new Date(),
            status: 'processing'
        };

        setDocuments(prev => [...prev, newDoc]);

        // Simulate processing
        setTimeout(() => {
            setDocuments(prev =>
                prev.map(doc =>
                    doc.id === newDoc.id ? { ...doc, status: 'ready' } : doc
                )
            );
            setUploading(false);
        }, 2000);
    };

    const handleDelete = (id: string) => {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
    };

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
                            accept=".pdf,.txt,.md,.docx"
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
                            {uploading ? 'Uploading...' : 'Choose File'}
                        </label>
                        <p className="text-[10px] text-muted-foreground mt-3">
                            Supported: PDF, TXT, Markdown, DOCX (max 10MB)
                        </p>
                    </div>

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
                                                        {doc.uploadedAt.toLocaleDateString()}
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
