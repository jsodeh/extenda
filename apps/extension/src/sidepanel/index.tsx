import React from 'react';
import ReactDOM from 'react-dom/client';

if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
}

import App from './App';
import '../index.css';

import { ClerkProvider } from '@clerk/chrome-extension';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY || CLERK_PUBLISHABLE_KEY.includes('replace_this')) {
    console.error('❌ CLERK ERROR: Missing VITE_CLERK_PUBLISHABLE_KEY in apps/extension/.env');
    console.info('👉 Please add your actual Clerk Publishable Key to apps/extension/.env and run `pnpm build --filter extension`');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {CLERK_PUBLISHABLE_KEY && !CLERK_PUBLISHABLE_KEY.includes('replace_this') ? (
            <ClerkProvider 
                publishableKey={CLERK_PUBLISHABLE_KEY} 
                afterSignOutUrl="/"
                signInFallbackRedirectUrl={chrome.runtime.getURL('/')}
                signUpFallbackRedirectUrl={chrome.runtime.getURL('/')}
            >
                <App />
            </ClerkProvider>
        ) : (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>Auth Configuration Missing</h2>
                <p>Please check the console for instructions on how to set up your Clerk Publishable Key.</p>
            </div>
        )}
    </React.StrictMode>
);
