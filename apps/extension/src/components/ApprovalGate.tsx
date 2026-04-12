import { useState } from 'react';
import { X, CheckCircle, AlertCircle, Edit, Save, ArrowLeft } from 'lucide-react';

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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full border border-border overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                        </div>
                        <h2 className="text-lg font-bold text-foreground">Action Required</h2>
                    </div>
                    <button
                        onClick={onReject}
                        className="p-1.5 rounded-full hover:bg-muted transition-colors"
                        title="Cancel"
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold text-foreground leading-tight">
                            {step.description}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] uppercase font-bold tracking-widest rounded-md border border-primary/20">
                                {step.tool.replace(/Adapter_/g, '').replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>

                    {/* Parameters */}
                    {step.params && Object.keys(step.params).length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Parameters</h4>
                                {!isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
                                    >
                                        <Edit className="h-3.5 w-3.5" />
                                        <span>Edit Details</span>
                                    </button>
                                )}
                            </div>

                            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                                {Object.entries(isEditing ? editedParams : step.params).map(([key, value]) => (
                                    <div key={key} className="space-y-1.5">
                                        <label className="block text-[11px] font-bold text-muted-foreground uppercase">
                                            {key.replace(/_/g, ' ')}
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={String(value)}
                                                onChange={(e) => handleParamChange(key, e.target.value)}
                                                className="w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                                            />
                                        ) : (
                                            <div className="text-sm text-foreground font-mono bg-background/50 border border-border/50 rounded-lg px-3 py-2.5 break-all">
                                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {isEditing && (
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleSave}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                                    >
                                        <Save className="h-4 w-4" />
                                        <span>Save Changes</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditedParams(step.params || {});
                                            setIsEditing(false);
                                        }}
                                        className="px-4 py-2.5 bg-muted text-muted-foreground rounded-xl text-sm font-semibold hover:bg-muted/80 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Security Note */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                        <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-500/90 leading-relaxed italic">
                                <strong>Safety Check:</strong> Review the parameters carefully. Approving this will execute the code on your behalf.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 bg-muted/10 border-t border-border flex gap-3">
                    <button
                        onClick={onApprove}
                        disabled={isEditing}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                        <CheckCircle className="h-5 w-5" />
                        <span>Confirm & Execute</span>
                    </button>
                    <button
                        onClick={onReject}
                        className="flex-1 px-6 py-3.5 bg-muted text-foreground rounded-xl font-bold text-sm hover:bg-muted/80 border border-border transition-all active:scale-95"
                    >
                        Reject
                    </button>
                </div>
            </div>
        </div>
    );
}
