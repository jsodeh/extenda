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
import { useAuth } from '../contexts/auth-context';
import LoadingSpinner from '../components/LoadingSpinner';
import { TextShimmer } from '../components/ui/TextShimmer';
import { ChatSuggestions, STARTER_SUGGESTIONS, Suggestion } from '../components/chat/ChatSuggestions';
import { getApiUrl } from '../lib/api';
import { Globe, RefreshCw, X } from 'lucide-react';

interface FileAttachment {
    name: string;
    type: string;
    size: number;
    url?: string;  // For displaying after upload
    preview?: string; // Data URL for images
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
    const { user, accessToken, signOut, isLoaded } = useAuth();

    const isLoading = !isLoaded;

    const logout = async () => {
        await signOut();
    };

    // Keep storage in sync with accessToken (handled by AuthProvider now, but we keep it here for background script)
    useEffect(() => {
        if (!isLoaded) return; // Prevent wiping storage before it loads
        if (accessToken) {
            chrome.storage.local.set({ accessToken });
        } else {
            chrome.storage.local.remove(['accessToken']);
        }
    }, [accessToken, isLoaded]);
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
    const sessionIdRef = useRef<string | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>(STARTER_SUGGESTIONS);
    const [pendingPrompt, setPendingPrompt] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const workflowRef = useRef<{ id: string; steps: WorkflowStep[] } | null>(null);
    const [showSyncPrompt, setShowSyncPrompt] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [backendUrl, setBackendUrl] = useState<string>('');

    const handleSyncData = async () => {
        setSyncing(true);
        // Simulate data sync from backend
        await new Promise(resolve => setTimeout(resolve, 2000));
        setSyncing(false);
        setShowSyncPrompt(false);
        console.log('[Sync] History and workflows synchronized.');
    };

    const dismissSync = () => {
        setShowSyncPrompt(false);
    };



    // Keep refs in sync with state
    useEffect(() => {
        workflowRef.current = currentWorkflow;
    }, [currentWorkflow]);

    useEffect(() => {
        sessionIdRef.current = currentSessionId;
    }, [currentSessionId]);

    // Fetch dynamic suggestions based on history
    useEffect(() => {
        const fetchDynamicSuggestions = async () => {
            if (!accessToken) return;
            try {
                const API_URL = await getApiUrl();
                const response = await fetch(`${API_URL}/api/chat/sessions`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
// ...
                
                if (response.ok) {
                    const sessions = await response.json();
                    if (sessions.length > 0) {
                        const returningPrompts: Suggestion[] = [
                            { ...STARTER_SUGGESTIONS[2], title: 'Continued Research', description: 'Pick up where you left off on latest tech trends.' },
                            { ...STARTER_SUGGESTIONS[0], title: 'Inbox Zero', description: 'Let\'s clear out those emails from today.' },
                            { ...STARTER_SUGGESTIONS[3], title: 'Draft Follow-ups', description: 'Reply to those unresponded threads.' },
                            { ...STARTER_SUGGESTIONS[1], title: 'Schedule Planning', description: 'Review your upcoming week.' }
                        ];
                        setSuggestions(returningPrompts);
                    }
                }
            } catch (err) {
                console.warn('Failed to fetch sessions for suggestions:', err);
            }
        };
        fetchDynamicSuggestions();
    }, [accessToken]);

    // ... (useEffect)

    const handleApproval = async (approved: boolean) => {
        if (!currentExecutionId) return;

        let modelConfig = undefined;
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const storage = await chrome.storage.local.get([
                'extenda_provider_keys', 
                'extenda_active_provider',
                'extenda_default_models',
                'extenda_ollama_url'
            ]);
            
            if (storage.extenda_provider_keys && storage.extenda_active_provider) {
                const provider = storage.extenda_active_provider;
                modelConfig = {
                    provider: provider,
                    model: storage.extenda_default_models?.[provider] || (provider === 'google' ? 'gemini-2.0-flash' : provider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-latest'),
                    apiKey: storage.extenda_provider_keys[provider] || '',
                    baseURL: provider === 'ollama' ? storage.extenda_ollama_url : undefined
                };
            }
        }

        wsClient.emit('workflow:resume', {
            executionId: currentExecutionId,
            approved,
            stepId: pendingApproval?.id,
            modelConfig
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

        const checkEnvironment = async () => {
            const currentUrl = await getApiUrl();
            setBackendUrl(currentUrl);
        };
        checkEnvironment();

        // Listen for storage changes - Hard reload on backend switch for 100% reliability
        const handleStorageChange = (changes: any) => {
            if (changes.extenda_backend_target || changes.extenda_backend_url) {
                console.log('[Sync] Backend environment changed, refreshing app...');
                window.location.reload();
            }
        };
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
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
        // Defensive: ensure content is always defined to prevent downstream errors
        const safeMessage = {
            ...message,
            content: message.content ?? ''
        };
        setMessages(prev => [...prev, safeMessage]);
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

    // useEffect for WebSocket connection - runs when accessToken OR backendUrl changes
    useEffect(() => {
        const connectWs = async () => {
            if (accessToken) {
                const apiUrl = backendUrl || await getApiUrl();
                console.log(`[Socket] Connecting to ${apiUrl}...`);
                wsClient.connect(accessToken, apiUrl);
                wsClient.on('connect', () => {
                    console.log('[Socket] Connected to', apiUrl);
                    setStatus('Connected');
                });
                wsClient.on('disconnect', () => setStatus('Disconnected'));
            } else {
                wsClient.disconnect();
                setStatus('Disconnected');
            }
        };
        connectWs();

        return () => {
            if (!accessToken) wsClient.disconnect();
        };
    }, [accessToken, backendUrl]);

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
            // backend emits WORKFLOW_PLAN at start AND at pause.
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

        wsClient.on('workflow:complete', (data: any) => {
            // Persist the final state of the workflow to the message history
            if (workflowRef.current) {
                const finalWorkflow = workflowRef.current;
                setMessages(prev => {
                    // Force all steps to completed state to prevent stuck spinners
                    const finalSteps = finalWorkflow.steps.map(s => ({
                        ...s,
                        status: 'completed' as const,
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

                    // Use the backend's AI-generated rich summary if available
                    let summaryText = data?.summary || null;

                    // Only add message if we have a real backend summary
                    if (summaryText) {
                        return [...updated, {
                            id: Date.now().toString(),
                            role: 'assistant' as const,
                            content: summaryText,
                            timestamp: new Date()
                        }];
                    }

                    return updated; // No empty messages
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
            if (data.sessionId && !sessionIdRef.current) {
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
    }, [accessToken]); // Use sessionIdRef instead of currentSessionId to avoid re-registering all listeners on session creation

    const handleSubmit = async (message: string, files?: File[], modelConfig?: any) => {
        if (!message.trim() && (!files || files.length === 0)) return;

        // Create attachment info for display
        const attachments: FileAttachment[] = files?.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size
        })) || [];

        // Optimistically add user message with attachments
        const userMsgId = Date.now().toString();
        addMessage({
            id: userMsgId,
            role: 'user',
            content: message,
            timestamp: new Date(),
            attachments: attachments.length > 0 ? attachments : undefined
        });

        try {
            let fileContents: string[] = [];

            // Upload and process files if present
            if (files && files.length > 0 && accessToken) {
                const formData = new FormData();
                files.forEach(file => formData.append('files', file));

                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                const uploadRes = await fetch(`${API_URL}/api/knowledge/process-files`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: formData
                });

                if (!uploadRes.ok) {
                    throw new Error('File processing failed');
                }

                const result = await uploadRes.json();
                fileContents = result.contents || [];
            }

            // Include file contents in the workflow intent if any
            const enhancedMessage = fileContents.length > 0
                ? `${message}\n\n[Attached file contents]:\n${fileContents.join('\n---\n')}`
                : message;

            wsClient.emit('workflow:start', { intent: enhancedMessage, sessionId: currentSessionId, modelConfig });

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

            const API_URL = await getApiUrl();
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
                {/* Auto-Sync PromptOverlay */}
                {showSyncPrompt && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-full bg-primary/10">
                                    <Globe className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Backend Changed</h3>
                                    <p className="text-xs text-muted-foreground">Sync your history to this environment?</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={handleSyncData}
                                    disabled={syncing}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    <span>{syncing ? 'Syncing...' : 'Sync History & Workflows'}</span>
                                </button>
                                <button
                                    onClick={dismissSync}
                                    disabled={syncing}
                                    className="w-full py-3 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-all disabled:opacity-50"
                                >
                                    Maybe Later
                                </button>
                            </div>
                            <p className="text-[10px] text-center text-muted-foreground">
                                Data is encrypted using your JWT_SECRET for privacy.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col min-h-full pb-20">
                    <div className="flex-1 flex flex-col">
                        {messages.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 transition-all duration-1000">
                                <div className="mb-4 animate-in fade-in zoom-in-50 duration-500">
                                <img
                                        src={iconDark}
                                        alt="Extenda Logo"
                                        className="w-12 h-12 dark:hidden drop-shadow-xl opacity-90"
                                    />
                                    <img
                                        src={iconLight}
                                        alt="Extenda Logo"
                                        className="w-12 h-12 hidden dark:block drop-shadow-xl opacity-90"
                                    />
                                </div>
                                
                                <ChatSuggestions 
                                    suggestions={suggestions} 
                                    onSelect={(p) => {
                                        setPendingPrompt(p);
                                        // Reset legacy trigger
                                        setTimeout(() => setPendingPrompt(''), 100);
                                    }} 
                                />
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
                            <div className="max-w-md mx-auto px-3 py-1">
                                <TextShimmer className="text-[11px] font-medium">
                                    {agentStatus.state === 'paused' ? 'Waiting for approval...' : agentStatus.message}
                                </TextShimmer>
                            </div>
                        )}
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 z-10">
                    <InputArea
                        onSend={handleSubmit}
                        disabled={!!pendingApproval}
                        sessionId={currentSessionId}
                        accessToken={accessToken}
                        initialValue={pendingPrompt}
                    />
                </div>
            </ChatLayout>
        </ErrorBoundary>
    );
}

export default function App() {
    return (
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <AppContent />
        </ThemeProvider>
    );
}
