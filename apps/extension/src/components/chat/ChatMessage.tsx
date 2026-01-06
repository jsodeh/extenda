import React from 'react';
import { User, Bot, AlertTriangle, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';
import PlanView from '../PlanView';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    workflow?: {
        id: string;
        steps: any[];
    };
    error?: boolean;
}

interface ChatMessageProps {
    message: Message;
    currentWorkflow?: { id: string; steps: any[] } | null;
    pendingStep?: any;
    onApprove?: () => void;
    onReject?: () => void;
}

const ChevronDown = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6" /></svg>
);

const ChevronUp = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m18 15-6-6-6 6" /></svg>
);

export function ChatMessage({ message, currentWorkflow, pendingStep, onApprove, onReject }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isError = message.content.toLowerCase().includes('error') || message.error;

    // Check if this message displays the active workflow that is pending approval
    const isPendingApproval = message.workflow && currentWorkflow && message.workflow.id === currentWorkflow.id && pendingStep;
    const [isExpanded, setIsExpanded] = React.useState(false); // Default to collapsed

    // Detect if this is a Plan update message (hidden in favor of the Plan component)
    if (message.content.includes('Created plan with') || message.content.includes('Workflow completed')) {
        // We still render it, but maybe distinct style
    }

    // Format error message using regex to see if it's a JSON block
    let displayContent = message.content;
    let isJsonError = false;

    if (isError && message.content.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(message.content);
            if (parsed.error && parsed.error.includes('429')) {
                displayContent = "We are experiencing high traffic. Please try again in a moment.";
                isJsonError = true;
            } else if (parsed.message) {
                displayContent = parsed.message;
                isJsonError = true;
            }
        } catch (e) {
            // Not JSON, ignore
        }
    }

    return (
        <div className={cn(
            "group w-full py-3",
            isSystem ? "bg-muted/30" : "bg-background"
        )}>
            <div className="max-w-3xl mx-auto px-4 flex gap-3">
                {/* Avatar Column - only show for user and system messages */}
                {(isUser || isSystem) && (
                    <div className="flex-shrink-0 flex flex-col items-center">
                        <div className={cn(
                            "h-6 w-6 rounded-sm flex items-center justify-center",
                            isUser ? "bg-muted" :
                                "bg-orange-50 dark:bg-orange-900/20"
                        )}>
                            {isUser ? <User size={12} className="text-muted-foreground" /> :
                                <AlertTriangle size={12} className="text-orange-600 dark:text-orange-400" />}
                        </div>
                    </div>
                )}

                {/* Content Column */}
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-baseline justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            {isUser ? "You" : isSystem ? "System" : "Extenda"}
                        </span>
                        <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    <div className="max-w-none text-foreground break-words leading-relaxed text-xs">
                        {isError ? (
                            <div className="text-destructive text-xs">
                                <p className="font-medium flex items-center gap-1">
                                    <AlertTriangle size={10} />
                                    {isJsonError ? 'Error' : 'Error'}
                                </p>
                                <p className="mt-0.5 opacity-90">{displayContent}</p>
                            </div>
                        ) : message.content.startsWith('✅ Step Completed') || message.content.startsWith('❌ Step Failed') ? (
                            <div className="text-[10px] font-mono">
                                <p className="whitespace-pre-wrap">{displayContent}</p>
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap">{displayContent}</p>
                        )}

                        {/* Inline Plan View */}
                        {message.workflow && (
                            <div className="mt-4 not-prose">
                                <PlanView steps={currentWorkflow?.id === message.workflow.id
                                    ? currentWorkflow.steps
                                    : message.workflow.steps}
                                />

                                {/* Approval Controls */}
                                {isPendingApproval && (
                                    <div className="mt-4 flex flex-col gap-3 p-4 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/50 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                                                <div>
                                                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-500">
                                                        Approval Required
                                                    </h4>
                                                    <p className="text-sm text-yellow-700 dark:text-yellow-600 mt-1">
                                                        {pendingStep.tool} needs your permission to proceed.
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsExpanded(!isExpanded)}
                                                className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-full transition-colors"
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4 text-yellow-600" /> : <ChevronDown className="w-4 h-4 text-yellow-600" />}
                                            </button>
                                        </div>

                                        {isExpanded && pendingStep.params && (
                                            <div className="mt-2 text-xs font-mono bg-white/50 dark:bg-black/20 p-2 rounded max-h-40 overflow-y-auto">
                                                {JSON.stringify(pendingStep.params, null, 2)}
                                            </div>
                                        )}

                                        <div className="flex gap-3 mt-1 pl-8">
                                            <button
                                                onClick={onReject}
                                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={onApprove}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
