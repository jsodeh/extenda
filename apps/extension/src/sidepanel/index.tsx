import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../index.css';
import { AuthProvider } from '../contexts/auth-context';

if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
}

if (typeof (window as any).process === 'undefined') {
    (window as any).process = { env: { NODE_ENV: import.meta.env.MODE } };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </React.StrictMode>
);
