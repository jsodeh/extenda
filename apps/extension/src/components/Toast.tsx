import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastNotificationProps {
    toast: Toast;
    onClose: (id: string) => void;
}

function ToastNotification({ toast, onClose }: ToastNotificationProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(toast.id);
        }, toast.duration || 5000);

        return () => clearTimeout(timer);
    }, [toast, onClose]);

    const icons = {
        success: CheckCircle,
        error: AlertCircle,
        info: Info
    };

    const colors = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    const Icon = icons[toast.type];

    return (
        <div className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${colors[toast.type]} animate-slide-in`}>
            <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
                onClick={() => onClose(toast.id)}
                className="p-1 rounded hover:bg-black/10"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        // Global toast handler
        const handleToast = (event: CustomEvent<Omit<Toast, 'id'>>) => {
            const toast: Toast = {
                ...event.detail,
                id: Date.now().toString()
            };
            setToasts(prev => [...prev, toast]);
        };

        window.addEventListener('show-toast' as any, handleToast);
        return () => window.removeEventListener('show-toast' as any, handleToast);
    }, []);

    const handleClose = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
            {toasts.map(toast => (
                <ToastNotification key={toast.id} toast={toast} onClose={handleClose} />
            ))}
        </div>
    );
}

// Utility function to show toasts
export function showToast(type: ToastType, message: string, duration?: number) {
    window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { type, message, duration }
    }));
}
