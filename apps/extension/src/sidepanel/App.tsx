import { useEffect, useState, useRef } from 'react';
import iconLight from '../assets/icon-light.png';
import iconDark from '../assets/icon-dark.png';
import { Send } from 'lucide-react';
import { wsClient } from '../lib/websocket';
import { ChatLayout } from '../components/chat/ChatLayout';
import { ChatMessage } from '../components/chat/ChatMessage';
import { InputArea } from '../components/chat/InputArea';
import { ThemeProvider } from '../components/ThemeProvider';
import NavigationMenu, { Page } from '../components/NavigationMenu';
import OnboardingWizard from '../components/OnboardingWizard';
import ApprovalGate from '../components/ApprovalGate';
import IntegrationsPage from '../pages/IntegrationsPage';
import SettingsPage from '../pages/SettingsPage';
import HistoryPage from '../pages/HistoryPage';
import KnowledgebasePage from '../pages/KnowledgebasePage';
import TemplatesPage from '../pages/TemplatesPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastContainer } from '../components/Toast';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { TextShimmer } from '../components/ui/TextShimmer';

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

interface WorkflowStep {
    id: string;
    tool: string;
    description: string;
    params?: any;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    result?: any;
    error?: string;
}

function AppContent() {
    const { user, logout, isLoading, accessToken } = useAuth();
    const [currentPage, setCurrentPage] = useState<Page>('chat');
    const [messages, setMessages] = useState<Message[]>([]);
    const [status, setStatus] = useState('Disconnected');
    const [agentStatus, setAgentStatus] = useState<{ state: string; message: string } | null>(null);
    const [currentWorkflow, setCurrentWorkflow] = useState<{ id: string; steps: WorkflowStep[] } | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [pendingApproval, setPendingApproval] = useState<WorkflowStep | null>(null);
    const [showRegister, setShowRegister] = useState(false);
    const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const workflowRef = useRef<{ id: string; steps: WorkflowStep[] } | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        workflowRef.current = currentWorkflow;
    }, [currentWorkflow]);

    // ... (useEffect)

    const handleApproval = (approved: boolean) => {
        if (!currentExecutionId) return;

        wsClient.emit('workflow:resume', {
            executionId: currentExecutionId,
            approved
        });

        if (!approved) {
            setPendingApproval(null);
            setCurrentWorkflow(null);
            addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: 'Workflow cancelled by user.',
                timestamp: new Date()
            });
        } else {
            // Optimistic update: Set status to in-progress for the pending step and agent status
            setPendingApproval(null);
            setAgentStatus({ state: 'executing', message: 'Resuming...' });
            if (pendingApproval && currentWorkflow) {
                updateWorkflowStep(pendingApproval.id, { status: 'in-progress' });
            }
            // Workflow continues, status updates will follow
        }
    };

    useEffect(() => {
        const onboardingComplete = localStorage.getItem('onboarding_complete');
        if (!onboardingComplete) {
            setShowOnboarding(true);
        }
    }, []);

    const scrollToBottom = () => {
        // slight delay to ensure DOM updates are painted
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, currentWorkflow]);

    const addMessage = (message: Message) => {
        setMessages(prev => [...prev, message]);
    };

    const updateWorkflowStep = (stepId: string, updates: Partial<WorkflowStep>) => {
        setCurrentWorkflow(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                steps: prev.steps.map(step =>
                    step.id === stepId ? { ...step, ...updates } : step
                )
            };
        });
    };

    // useEffect for WebSocket connection - only runs when accessToken changes
    useEffect(() => {
        if (accessToken) {
            wsClient.connect(accessToken);
            wsClient.on('connect', () => setStatus('Connected'));
            wsClient.on('disconnect', () => setStatus('Disconnected'));
        } else {
            wsClient.disconnect();
            setStatus('Disconnected');
        }

        return () => {
            // Don't disconnect on cleanup unless accessToken is gone
            if (!accessToken) {
                wsClient.disconnect();
            }
        };
    }, [accessToken]);

    // useEffect for event listeners - runs once on mount
    useEffect(() => {
        wsClient.on('agent:status', (data: any) => {
            // Only show if not idle
            if (data.state === 'idle') {
                setAgentStatus(null);
            } else {
                setAgentStatus(data);
            }
        });

        wsClient.on('session:created', (data: { sessionId: string }) => {
            setCurrentSessionId(data.sessionId);
        });

        wsClient.on('workflow:plan', (data: any) => {
            const workflowId = data.plan.id || `workflow-${Date.now()}`;
            const incomingSteps = (data.plan.definition?.steps || data.plan.steps || []).map((s: any) => ({
                id: s.id,
                tool: s.tool,
                description: s.description || `Execute ${s.tool}`,
                params: s.params,
                status: 'pending' as const
            }));

            // Use functional update to access latest state and merge
            setCurrentWorkflow(prev => {
                const isSameWorkflow = prev && prev.id === workflowId;

                const mergedSteps = incomingSteps.map((step: any) => {
                    if (isSameWorkflow) {
                        const existingStep = prev.steps.find((s: WorkflowStep) => s.id === step.id);
                        if (existingStep) {
                            return { ...step, status: existingStep.status, result: existingStep.result, error: existingStep.error };
                        }
                    }
                    return step;
                });

                return {
                    id: workflowId,
                    steps: mergedSteps
                };
            });

            if (data.executionId) {
                setCurrentExecutionId(data.executionId);
            }

            // Only add the plan message if it's a NEW workflow (or we can just log it always, but might be spammy on pause)
            // If status is paused, it's an update. If status is NOT paused, it's likely a new start (or just a plan event).
            // Actually, backend emits WORKFLOW_PLAN at start AND at pause.
            // We probably only want to show "Created plan" once.
            // But we can't easily check `prev` here outside the setter.
            // Let's rely on data.status. If 'paused', don't add "Created plan" message? 
            // Or just add it. The user will see "Created plan" then "Waiting for approval". 
            // If the plan is re-emitted, we might get duplicate messages. 
            // Ideally we check if we already have this workflow ID in messages?
            // But `messages` is also stale in closure. 
            // For now, let's just add it. It's better to be verbose than missing info.

            if (data.status !== 'paused') {
                setMessages(prev => {
                    const exists = prev.some(m => m.workflow?.id === workflowId);
                    if (exists) return prev;
                    return [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: `Created plan with ${incomingSteps.length} steps`,
                        timestamp: new Date(),
                        workflow: { id: workflowId, steps: incomingSteps }
                    }];
                });
            }

            // HITL: Check for pause
            if (data.status === 'paused') {
                // Determine which step is pending (usually the first one or the next pending one)
                // If pendingStepId is provided use it, otherwise fallback
                const pendingStepId = data.pendingStepId;
                const targetStep = pendingStepId
                    ? incomingSteps.find((s: any) => s.id === pendingStepId)
                    : incomingSteps[0];

                setPendingApproval({
                    id: targetStep?.id || 'gate-' + Date.now(),
                    tool: targetStep?.tool || 'Approval Required',
                    description: targetStep?.description || 'Review the plan above before proceeding.',
                    params: targetStep?.params,
                    status: 'pending'
                });
            }
        });

        wsClient.on('workflow:step_start', (data: any) => {
            updateWorkflowStep(data.step.id, { status: 'in-progress' });
        });

        wsClient.on('workflow:step_complete', (data: any) => {
            updateWorkflowStep(data.stepId, {
                status: 'completed',
                result: data.result
            });
        });

        wsClient.on('workflow:complete', () => {
            // Persist the final state of the workflow to the message history
            if (workflowRef.current) {
                const finalWorkflow = workflowRef.current;
                setMessages(prev => {
                    // Force all steps to completed state to prevent stuck spinners
                    const finalSteps = finalWorkflow.steps.map(s => ({
                        ...s,
                        status: 'completed' as const,
                        // If it was already completed, keep result, else undefined (or could imply success)
                        result: s.result
                    }));

                    const completedWorkflow = { ...finalWorkflow, steps: finalSteps };

                    const updated = prev.map(msg => {
                        if (msg.workflow?.id === finalWorkflow.id) {
                            return {
                                ...msg,
                                workflow: completedWorkflow
                            };
                        }
                        return msg;
                    });

                    // Determine final output message
                    let finalContent = 'Workflow completed successfully.';

                    // Look for the last completed step with a meaningful result
                    const completedSteps = finalSteps;
                    if (completedSteps && completedSteps.length > 0) {
                        // Strategy 1: Check for tool-specific success messages
                        const toolTypes = completedSteps.map(s => s.tool);

                        // Email workflows
                        if (toolTypes.some(t => t?.includes('GmailAdapter_send') || t?.includes('gmail') && t?.includes('send'))) {
                            finalContent = '✅ Email sent successfully!';
                        }
                        // Calendar workflows  
                        else if (toolTypes.some(t => t?.includes('GoogleCalendarAdapter') || t?.includes('calendar'))) {
                            if (toolTypes.some(t => t?.includes('create') || t?.includes('add'))) {
                                finalContent = '✅ Calendar event created successfully!';
                            } else if (toolTypes.some(t => t?.includes('list') || t?.includes('get'))) {
                                finalContent = '✅ Calendar checked successfully!';
                            } else {
                                finalContent = '✅ Calendar updated successfully!';
                            }
                        }
                        // If no tool-specific message, try extracting meaningful result
                        else {
                            // Strategy 2: Iterate backwards to find the first meaningful "content" result.
                            // Ideally, we want the result of the main action (Summary), not the side-effect (Notifier).

                            let meaningfulResult = null;

                            const lastStep = completedSteps[completedSteps.length - 1];

                            // Check last step matches specially
                            if (lastStep.tool === 'Notifier' && lastStep.params && lastStep.params.message) {
                                meaningfulResult = `*Notification sent:* ${lastStep.params.message}`;
                            }

                            // If no specific notifier message or we want to look deeper:
                            if (!meaningfulResult) {
                                for (let i = completedSteps.length - 1; i >= 0; i--) {
                                    const step = completedSteps[i];
                                    if (!step.result) continue;

                                    const res = step.result;

                                    // Helper to extract text from result object
                                    const extractText = (r: any): string | null => {
                                        if (!r) return null;
                                        if (typeof r === 'string') return r;
                                        if (typeof r === 'object') {
                                            // Prioritize explicit friendly fields
                                            if (r.output) return typeof r.output === 'string' ? r.output : JSON.stringify(r.output, null, 2);
                                            if (r.payload) return typeof r.payload === 'string' ? r.payload : JSON.stringify(r.payload, null, 2);
                                            if (r.message && r.message.length > 20) return r.message; // meaningful message
                                            if (r.summary) return `**Summary:**\n${r.summary}`;
                                            if (r.analysis) return `**Analysis:**\n${JSON.stringify(r.analysis, null, 2)}`;

                                            // Special handling for Gmail list_emails result
                                            if (r.emails && Array.isArray(r.emails) && r.emails.length > 0) {
                                                const items = r.emails.slice(0, 5).map((e: any) =>
                                                    `- **${e.from || 'Unknown'}**: ${e.subject || '(No Subject)'}`
                                                ).join('\n');
                                                return `**Found ${r.emails.length} emails:**\n${items}${r.emails.length > 5 ? '\n...' : ''}`;
                                            }

                                            // Avoid returning "{success: true}" or small status objects
                                            const keys = Object.keys(r);
                                            if (keys.length === 1 && keys[0] === 'success') return null;

                                            // Fallback recursion for nested result
                                            if (r.result) return extractText(r.result);

                                            // If it has many keys, might be data? 
                                            if (keys.length > 2) return JSON.stringify(r, null, 2);
                                        }
                                        return null;
                                    };

                                    const text = extractText(res);
                                    if (text) {
                                        meaningfulResult = text;
                                        break; // Found the most recent meaningful output
                                    }
                                }
                            }

                            if (meaningfulResult) {
                                finalContent = meaningfulResult;
                            }
                        }
                    }

                    // Add the final message (as Assistant if it's content, System if generic)
                    const isGeneric = finalContent === 'Workflow completed successfully.';
                    return [...updated, {
                        id: Date.now().toString(),
                        role: isGeneric ? 'system' : 'assistant',
                        content: finalContent,
                        timestamp: new Date()
                    }];
                });
            }

            setAgentStatus(null);
            setCurrentWorkflow(null);
            setPendingApproval(null);
        });

        wsClient.on('chat:response', (data: any) => {
            setAgentStatus(null);
            addMessage({
                id: Date.now().toString(),
                role: 'assistant',
                content: data.message,
                timestamp: new Date()
            });
            if (data.sessionId && !currentSessionId) {
                setCurrentSessionId(data.sessionId);
            }
        });

        wsClient.on('workflow:error', (data: any) => {
            setAgentStatus(null);
            // Keep the workflow state for inspection if needed, or clear it
            // Error highlighting handled by ChatMessage
            addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: typeof data.error === 'object' ? JSON.stringify(data) : `Error: ${data.error}`,
                timestamp: new Date(),
                error: true
            });
        });

        return () => {
            wsClient.off('workflow:plan');
            wsClient.off('workflow:step_start');
            wsClient.off('workflow:step_complete');
            wsClient.off('workflow:complete');
            wsClient.off('agent:status');
            wsClient.off('chat:response');
            wsClient.off('workflow:error');
            wsClient.off('session:created');
        };
    }, [accessToken, currentSessionId]); // Add currentSessionId to dependency if needed, or better use ref for sessionId if callback is stale

    const handleSubmit = async (message: string, file?: File) => {
        if (!message.trim() && !file) return;

        // Optimistically add user message
        const userMsgId = Date.now().toString();
        addMessage({
            id: userMsgId,
            role: 'user',
            content: message + (file ? ` [Attached: ${file.name}]` : ''),
            timestamp: new Date()
        });

        try {
            // Upload file if present
            if (file && accessToken) {
                const formData = new FormData();
                formData.append('file', file);

                const uploadRes = await fetch('https://extenda-api-604583941288.us-central1.run.app/api/knowledge/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: formData
                });

                if (!uploadRes.ok) {
                    throw new Error('File upload failed');
                }

                // Add system notification for upload? Or just let the AI know via context? 
                // The AI will find it in knowledge base via RAG.
            }



            wsClient.emit('workflow:start', { intent: message, sessionId: currentSessionId });

        } catch (error) {
            console.error('Submission failed:', error);
            addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: `Error: Failed to process request. ${(error as Error).message}`,
                timestamp: new Date(),
                error: true
            });
        }
    };

    const handleRecieveNavigation = (page: Page) => {
        if (page === ('new_chat' as Page)) {
            setCurrentSessionId(null);
            setMessages([]);
            setCurrentWorkflow(null);
            setPendingApproval(null);
            setCurrentPage('chat');
        } else {
            setCurrentPage(page);
        }
    };

    const handleSelectSession = async (sessionId: string) => {
        if (!accessToken) return;
        try {
            setCurrentSessionId(sessionId);
            setCurrentPage('chat');
            setMessages([]); // Clear while loading

            const API_URL = 'https://extenda-api-604583941288.us-central1.run.app';
            const response = await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.ok) {
                const history = await response.json();
                // Convert DB messages to local Message format
                const mappedMessages = history.map((m: any) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: new Date(m.createdAt),
                    // Reconstruct workflow with steps from metadata
                    workflow: m.metadata?.workflow ? {
                        id: m.metadata.workflow.id || m.metadata.workflowId,
                        steps: m.metadata.workflow.steps || []
                    } : undefined
                }));
                setMessages(mappedMessages);
            }
        } catch (err) {
            console.error('Failed to load session:', err);
        }
    };

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <LoadingSpinner size="lg" text="Loading..." />
            </div>
        );
    }

    // Show auth pages if not logged in
    if (!user) {
        return (
            <div className="bg-background min-h-screen">
                {showRegister ? (
                    <RegisterPage onSwitch={() => setShowRegister(false)} />
                ) : (
                    <LoginPage onSwitch={() => setShowRegister(true)} />
                )}
            </div>
        );
    }

    // Show onboarding if first time
    if (showOnboarding) {
        return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
    }

    // Secondary Pages Wrapper
    const renderPage = () => {
        if (currentPage === 'integrations' || currentPage === 'settings') return <SettingsPage onBack={() => setCurrentPage('chat')} />;
        if (currentPage === 'history') return <HistoryPage onSelectSession={handleSelectSession} onBack={() => setCurrentPage('chat')} />;
        if (currentPage === 'templates') return <TemplatesPage onBack={() => setCurrentPage('chat')} />;
        if (currentPage === 'knowledgebase') return <KnowledgebasePage onBack={() => setCurrentPage('chat')} />;
        return null;
    };

    if (currentPage !== 'chat') {
        return (
            <div className="flex flex-col h-screen bg-background">
                {renderPage()}
            </div>
        );
    }

    // Main Chat Interface
    return (
        <ErrorBoundary>
            <ToastContainer />
            <ChatLayout
                currentPage={currentPage}
                onNavigate={handleRecieveNavigation}
                status={status}
                onReconnect={() => accessToken && wsClient.connect(accessToken)}
            >
                <div className="flex flex-col min-h-full pb-60">
                    <div className="flex-1">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-8 opacity-50">
                                <div className="flex flex-col items-center justify-center">
                                    <img
                                        src={iconLight}
                                        alt="Extenda Logo"
                                        className="w-24 h-24 dark:hidden drop-shadow-lg"
                                    />
                                    <img
                                        src={iconDark}
                                        alt="Extenda Logo"
                                        className="w-24 h-24 hidden dark:block drop-shadow-lg"
                                    />
                                </div>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <ChatMessage
                                    key={message.id}
                                    message={message}
                                    currentWorkflow={currentWorkflow}
                                    pendingStep={pendingApproval}
                                    onApprove={() => handleApproval(true)}
                                    onReject={() => handleApproval(false)}
                                />
                            ))
                        )}
                        <div ref={messagesEndRef} />

                        {/* Thinking Indicator */}
                        {agentStatus && (
                            <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-sm bg-primary/10 flex items-center justify-center border border-primary/20">
                                    <span className="text-xs font-bold text-primary animate-pulse">E</span>
                                </div>
                                <TextShimmer className="text-sm font-medium">
                                    {agentStatus.state === 'paused' ? 'Waiting for approval...' : agentStatus.message}
                                </TextShimmer>
                            </div>
                        )}
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 z-10">
                    <InputArea onSend={handleSubmit} disabled={!!pendingApproval} />
                </div>
            </ChatLayout>
        </ErrorBoundary>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                <AppContent />
            </ThemeProvider>
        </AuthProvider>
    );
}
