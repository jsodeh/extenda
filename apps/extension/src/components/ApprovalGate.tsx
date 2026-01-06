import { useState } from 'react';
import { X, CheckCircle, AlertCircle, Edit } from 'lucide-react';

interface WorkflowStep {
    id: string;
    tool: string;
    description: string;
    params?: Record<string, any>;
}

interface ApprovalGateProps {
    step: WorkflowStep;
    onApprove: () => void;
    onReject: () => void;
    onEdit: (params: Record<string, any>) => void;
}

export default function ApprovalGate({ step, onApprove, onReject, onEdit }: ApprovalGateProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedParams, setEditedParams] = useState<Record<string, any>>(step.params || {});

    const handleParamChange = (key: string, value: any) => {
        setEditedParams(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        onEdit(editedParams);
        setIsEditing(false);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
                {/* Header */}
                <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-6 w-6 text-yellow-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Approval Required</h2>
                    </div>
                    <button
                        onClick={onReject}
                        className="p-1 rounded-lg hover:bg-gray-100"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {step.description}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                                {step.tool}
                            </span>
                        </div>
                    </div>

                    {/* Parameters */}
                    {step.params && Object.keys(step.params).length > 0 && (
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-gray-900">Parameters</h4>
                                {!isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        <Edit className="h-4 w-4" />
                                        <span>Edit</span>
                                    </button>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                {Object.entries(isEditing ? editedParams : step.params).map(([key, value]) => (
                                    <div key={key}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {key}
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={String(value)}
                                                onChange={(e) => handleParamChange(key, e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        ) : (
                                            <div className="text-sm text-gray-900 font-mono bg-white border border-gray-200 rounded px-3 py-2">
                                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {isEditing && (
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={handleSave}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                    >
                                        Save Changes
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditedParams(step.params || {});
                                            setIsEditing(false);
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Warning */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-yellow-800">
                            <strong>Review carefully:</strong> This action will execute the {step.tool} tool
                            {step.params && ` with the parameters shown above`}.
                            Make sure this is what you want to do.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onApprove}
                            disabled={isEditing}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CheckCircle className="h-5 w-5" />
                            <span>Approve</span>
                        </button>
                        <button
                            onClick={onReject}
                            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                        >
                            Reject
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
