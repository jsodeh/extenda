import { useState, useEffect } from 'react';
import { ArrowLeft, Rocket, Clock, Mail, Calendar, Search, Zap } from 'lucide-react';

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

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
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
        // Initialize parameters with defaults
        const initialParams: Record<string, any> = {};
        template.parameters.forEach(param => {
            initialParams[param.name] = param.default || '';
        });
        setParameters(initialParams);
    };

    const handleExecute = async () => {
        if (!selectedTemplate) return;

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const response = await fetch(`${API_URL}/api/templates/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: selectedTemplate.id,
                    parameters
                })
            });

            const data = await response.json();
            console.log('Workflow created:', data);
            // TODO: Trigger workflow execution
            alert('Workflow created from template!');
            setSelectedTemplate(null);
        } catch (error) {
            console.error('Failed to execute template:', error);
            alert('Failed to create workflow');
        }
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
                        <h1 className="text-2xl font-bold text-gray-900">Workflow Templates</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Pre-built workflows for common tasks
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600">Loading templates...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {templates.map((template) => {
                                const IconComponent = CATEGORY_ICONS[template.category] || Rocket;
                                return (
                                    <div
                                        key={template.id}
                                        onClick={() => handleSelectTemplate(template)}
                                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-all cursor-pointer"
                                    >
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="text-3xl">{template.icon}</div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900 mb-1">
                                                    {template.name}
                                                </h3>
                                                <p className="text-sm text-gray-600">
                                                    {template.description}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium capitalize">
                                                {template.category}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {template.parameters.length} params
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Template Parameters Modal */}
            {selectedTemplate && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
                        <div className="border-b border-gray-200 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{selectedTemplate.icon}</span>
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        {selectedTemplate.name}
                                    </h2>
                                    <p className="text-sm text-gray-600">
                                        {selectedTemplate.description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">
                                Configure Parameters
                            </h3>
                            <div className="space-y-4">
                                {selectedTemplate.parameters.map((param) => (
                                    <div key={param.name}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {param.description}
                                        </label>
                                        <input
                                            type={param.type === 'number' ? 'number' : 'text'}
                                            value={parameters[param.name] || ''}
                                            onChange={(e) =>
                                                setParameters({
                                                    ...parameters,
                                                    [param.name]: param.type === 'number'
                                                        ? parseInt(e.target.value)
                                                        : e.target.value
                                                })
                                            }
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
                            <button
                                onClick={handleExecute}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                            >
                                Create Workflow
                            </button>
                            <button
                                onClick={() => setSelectedTemplate(null)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
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
