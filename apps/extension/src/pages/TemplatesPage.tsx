import { useState, useEffect } from 'react';
import { ArrowLeft, Rocket, Mail, Calendar, Search, Zap, Loader2, CheckCircle2 } from 'lucide-react';

interface Template {
    id: number;
    name: string;
    description: string;
    category: string;
    icon: string;
    parameters: Array<{
        name: string;
        type: string;
        description: string;
        default?: any;
    }>;
}

const CATEGORY_ICONS: Record<string, any> = {
    email: Mail,
    calendar: Calendar,
    productivity: Search,
    automation: Zap
};

interface TemplatesPageProps {
    onBack?: () => void;
}

export default function TemplatesPage({ onBack }: TemplatesPageProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [parameters, setParameters] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const { getApiUrl } = await import('../lib/api');
            const API_URL = await getApiUrl();
            const response = await fetch(`${API_URL}/api/templates`);
            const data = await response.json();
            setTemplates(data.templates || []);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTemplate = (template: Template) => {
        setSelectedTemplate(template);
        const initialParams: Record<string, any> = {};
        template.parameters.forEach(param => {
            initialParams[param.name] = param.default || '';
        });
        setParameters(initialParams);
    };

    const handleExecute = async () => {
        if (!selectedTemplate) return;
        setExecuting(true);

        try {
            const { getApiUrl } = await import('../lib/api');
            const API_URL = await getApiUrl();
            const response = await fetch(`${API_URL}/api/templates/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: selectedTemplate.id,
                    parameters
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Workflow created:', data);
                setSelectedTemplate(null);
            }
        } catch (error) {
            console.error('Failed to execute template:', error);
        } finally {
            setExecuting(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Header */}
            <div className="border-b border-border bg-card px-6 py-4 shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1.5 -ml-1.5 rounded-full hover:bg-muted text-foreground transition-all active:scale-95"
                            title="Back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Workflow Templates</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Standardized workflows for common operations
                        </p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
                <div className="max-w-4xl mx-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading templates...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    onClick={() => handleSelectTemplate(template)}
                                    className="group relative bg-card rounded-2xl border-2 border-border p-5 hover:border-primary/50 hover:shadow-xl transition-all cursor-pointer overflow-hidden animate-in fade-in slide-in-from-bottom-2"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="text-4xl p-1 shrink-0 group-hover:scale-110 transition-transform duration-300">
                                            {template.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-base truncate mb-1">
                                                {template.name}
                                            </h3>
                                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                {template.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                                {template.category}
                                            </span>
                                            <span className="text-[10px] font-medium text-muted-foreground">
                                                {template.parameters.length} parameters
                                            </span>
                                        </div>
                                        <div className="p-1.5 rounded-lg bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Zap className="h-3 w-3 text-primary" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Config Modal Overlay */}
            {selectedTemplate && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="border-b border-border px-6 py-5 bg-muted/30">
                            <div className="flex items-center gap-4">
                                <span className="text-4xl shrink-0">{selectedTemplate.icon}</span>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold truncate">
                                        {selectedTemplate.name}
                                    </h2>
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                        {selectedTemplate.description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5 no-scrollbar">
                            <h3 className="text-xs font-bold text-primary uppercase tracking-widest px-1">
                                Configuration
                            </h3>
                            <div className="space-y-4">
                                {selectedTemplate.parameters.map((param) => (
                                    <div key={param.name} className="space-y-1.5">
                                        <label className="block text-xs font-bold text-foreground ml-1">
                                            {param.description}
                                        </label>
                                        <input
                                            type={param.type === 'number' ? 'number' : 'text'}
                                            value={parameters[param.name] || ''}
                                            onChange={(e) =>
                                                setParameters({
                                                    ...parameters,
                                                    [param.name]: param.type === 'number'
                                                        ? parseInt(e.target.value) || 0
                                                        : e.target.value
                                                })
                                            }
                                            className="w-full rounded-xl border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-muted-foreground/50"
                                            placeholder={`Enter ${param.name.toLowerCase()}...`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-border p-4 flex gap-3 bg-muted/10">
                            <button
                                onClick={handleExecute}
                                disabled={executing}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 active:scale-95"
                            >
                                {executing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                {executing ? 'Deploying...' : 'Create Workflow'}
                            </button>
                            <button
                                onClick={() => setSelectedTemplate(null)}
                                disabled={executing}
                                className="px-6 py-3 bg-muted text-foreground border border-border rounded-xl font-bold text-sm hover:bg-muted/80 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
