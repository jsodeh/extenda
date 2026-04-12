import React from 'react';
import { User, Bot, AlertTriangle, Terminal, FileText, Image as ImageIcon, Music, Video, File } from 'lucide-react';
import { cn } from '../../lib/utils';
import PlanView from '../PlanView';

interface FileAttachment {
    name: string;
    type: string;
    size: number;
    url?: string;
    preview?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    workflow?: {
        id: string;
        steps: any[];
    };
    attachments?: FileAttachment[];
    error?: boolean;
}

// Get icon for file type
const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('audio/')) return Music;
    if (type.startsWith('video/')) return Video;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return FileText;
    return File;
};

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
    const isError = message.content?.toLowerCase().includes('error') || message.error;

    // Check if this message displays the active workflow that is pending approval
    const isPendingApproval = message.workflow && currentWorkflow && message.workflow.id === currentWorkflow.id && pendingStep;
    const [isExpanded, setIsExpanded] = React.useState(false); // Default to collapsed

    // Detect if this is a Plan update message (hidden in favor of the Plan component)
    if (message.content?.includes('Created plan with') || message.content?.includes('Workflow completed')) {
        // We still render it, but maybe distinct style
    }

    // Format error message using regex to see if it's a JSON block
    let displayContent = message.content || '';
    let isJsonError = false;

    if (isError && displayContent.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(displayContent);
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
            "group w-full py-4 border-b border-border/10",
            isSystem ? "bg-muted/10 italic" : "bg-transparent"
        )}>
            <div className="max-w-3xl mx-auto px-4">
                {/* Content Column - no avatar icons for cleaner alignment */}
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-baseline justify-between mb-0.5">
                        <span className={cn(
                            "text-[10px] uppercase font-bold tracking-widest",
                            isUser ? "text-primary/70" : isSystem ? "text-muted-foreground/60" : "text-emerald-500/70"
                        )}>
                            {isUser ? "You" : isSystem ? "System" : "Extenda"}
                        </span>
                        <span className="text-[9px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    <div className="max-w-none text-foreground break-words leading-relaxed text-[13px]">
                        {isError ? (
                            <div className="text-destructive text-[13px] bg-destructive/5 p-3 rounded-lg border border-destructive/10">
                                <p className="font-bold flex items-center gap-1.5 uppercase tracking-tight text-[11px]">
                                    <AlertTriangle size={12} strokeWidth={3} />
                                    {isJsonError ? 'Execution Error' : 'System Error'}
                                </p>
                                <p className="mt-1 opacity-90">{displayContent}</p>
                            </div>
                        ) : message.content?.startsWith('✅ Step Completed') || message.content?.startsWith('❌ Step Failed') ? (
                            <div className="text-[11px] font-mono bg-muted/20 p-2 rounded-md italic border border-border/10">
                                <p className="whitespace-pre-wrap">{displayContent}</p>
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap">{displayContent}</p>
                        )}

                        {/* File Attachments Display for User Messages */}
                        {isUser && message.attachments && message.attachments.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {message.attachments.map((attachment, index) => {
                                    const FileIcon = getFileIcon(attachment.type);
                                    return (
                                        <div
                                            key={`${attachment.name}-${index}`}
                                            className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-lg border border-border/30 flex-shrink-0"
                                            title={attachment.name}
                                        >
                                            <FileIcon size={12} className="text-primary" />
                                            <span className="text-[10px] font-medium text-foreground truncate max-w-[100px]">
                                                {attachment.name}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Inline Plan View */}
                        {message.workflow && (
                            <div className="mt-5 not-prose">
                                <PlanView steps={currentWorkflow?.id === message.workflow.id
                                    ? currentWorkflow.steps
                                    : message.workflow.steps}
                                />

                                {/* Approval Controls */}
                                {isPendingApproval && (
                                    <div className="mt-4 flex flex-col gap-4 p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className="p-2 bg-amber-500/10 rounded-xl">
                                                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-foreground">
                                                        Approval Required
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Action: <span className="font-mono text-primary">{pendingStep.tool}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsExpanded(!isExpanded)}
                                                className="p-1.5 hover:bg-muted rounded-full transition-colors"
                                            >
                                                {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                            </button>
                                        </div>

                                        {isExpanded && pendingStep.params && (
                                            <div className="mt-1 text-[11px] font-mono bg-background/50 border border-border/50 p-3 rounded-xl max-h-48 overflow-y-auto shadow-inner">
                                                {JSON.stringify(pendingStep.params, null, 2)}
                                            </div>
                                        )}

                                        <div className="flex gap-3 pl-1">
                                            <button
                                                onClick={onApprove}
                                                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={onReject}
                                                className="px-5 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-all border border-border active:scale-95"
                                            >
                                                Reject
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
