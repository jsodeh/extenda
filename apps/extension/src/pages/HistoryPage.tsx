import { useEffect, useState } from 'react';
import { MessageSquare, Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';

interface ChatSession {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

interface HistoryPageProps {
    onSelectSession: (sessionId: string) => void;
    onBack?: () => void;
}

export default function HistoryPage({ onSelectSession, onBack }: HistoryPageProps) {
    const { accessToken, isLoaded } = useAuth();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isLoaded) {
            loadSessions();
        }
    }, [isLoaded]);

    const loadSessions = async () => {
        try {
            if (!accessToken) {
                setLoading(false);
                return;
            }
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

            const response = await fetch(`${API_URL}/api/chat/sessions`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSessions(data);
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full text-muted-foreground">
                <Clock className="w-6 h-6 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <div className="border-b border-border bg-card px-6 py-4 shadow-sm flex items-center gap-3">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors"
                        title="Back"
                    >
                        <ArrowLeft className="h-6 w-6 text-foreground" />
                    </button>
                )}
                <h1 className="text-xl font-bold text-foreground">Chat History</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {sessions.length === 0 ? (
                    <div className="text-center text-muted-foreground mt-10">
                        No chat history found.
                    </div>
                ) : (
                    sessions.map(session => (
                        <button
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            className="w-full bg-card p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all text-left group"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-start gap-3">
                                    <div className="bg-primary/10 p-2 rounded-full text-primary">
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                            {session.title || 'New Chat'}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(session.updatedAt || session.createdAt).toLocaleDateString()} • {new Date(session.updatedAt || session.createdAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
