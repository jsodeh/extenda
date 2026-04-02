import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../index.css';

import { ClerkProvider } from '@clerk/react';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
            <App />
        </ClerkProvider>
    </React.StrictMode>
);
