import { useEffect, useState } from 'react';
import { MessageSquare, Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
    const { accessToken, isLoading: authLoading } = useAuth();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;

        if (!accessToken) {
            setLoading(false);
            return;
        }

        loadSessions();
    }, [accessToken, authLoading]);

    const loadSessions = async () => {
        if (!accessToken) return;
        try {
            const API_URL = 'https://extenda-api-604583941288.us-central1.run.app';

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
            <div className="flex justify-center items-center h-full text-gray-400">
                <Clock className="w-6 h-6 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <div className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm flex items-center gap-3">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="p-1 -ml-1 rounded-full hover:bg-gray-100 transition-colors"
                        title="Back"
                    >
                        <ArrowLeft className="h-6 w-6 text-gray-600" />
                    </button>
                )}
                <h1 className="text-2xl font-bold text-gray-900">Chat History</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {sessions.length === 0 ? (
                    <div className="text-center text-gray-500 mt-10">
                        No chat history found.
                    </div>
                ) : (
                    sessions.map(session => (
                        <button
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            className="w-full bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow text-left group"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-start gap-3">
                                    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {session.title || 'New Chat'}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {new Date(session.updatedAt || session.createdAt).toLocaleDateString()} • {new Date(session.updatedAt || session.createdAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
