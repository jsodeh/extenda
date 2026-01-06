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
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1 -ml-1 rounded-full hover:bg-gray-100 transition-colors"
                            title="Back"
                        >
                            <ArrowLeft className="h-6 w-6 text-gray-600" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Knowledgebase</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Upload documents to enhance AI responses with your data
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Upload Area */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 bg-white'
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Upload Documents
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
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
                            className={`inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-medium cursor-pointer transition-colors ${uploading
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-blue-700'
                                }`}
                        >
                            {uploading ? 'Uploading...' : 'Choose File'}
                        </label>
                        <p className="text-xs text-gray-500 mt-3">
                            Supported: PDF, TXT, Markdown, DOCX (max 10MB)
                        </p>
                    </div>

                    {/* Documents List */}
                    {documents.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Your Documents ({documents.length})
                            </h2>
                            <div className="space-y-2">
                                {documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-gray-900 truncate">
                                                    {doc.name}
                                                </h3>
                                                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
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
                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                                    Processing...
                                                </span>
                                            )}
                                            {doc.status === 'ready' && (
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                            )}
                                            {doc.status === 'failed' && (
                                                <AlertCircle className="h-5 w-5 text-red-600" />
                                            )}

                                            {/* Delete */}
                                            <button
                                                onClick={() => handleDelete(doc.id)}
                                                className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 mb-2">
                            How it works
                        </h3>
                        <ul className="text-sm text-blue-800 space-y-1">
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
