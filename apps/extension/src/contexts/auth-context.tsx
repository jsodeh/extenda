import React, { createContext, useContext, useEffect, useState } from 'react';
import { getApiUrl } from '../lib/api';


interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  primaryEmailAddress?: {
    emailAddress: string;
  };
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoaded: boolean;
  signIn: (provider: 'google' | 'github') => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API_URL removed in favor of dynamic getApiUrl() in signIn method

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load auth state from storage on mount
    chrome.storage.local.get(['user', 'accessToken'], (result) => {
      if (result.user && result.accessToken) {
        setUser(result.user);
        setAccessToken(result.accessToken);
      }
      setIsLoaded(true);
    });

    // Listen for OAuth messages from the popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_success') {
        const { user, tokens } = event.data;
        setUser(user);
        setAccessToken(tokens.accessToken);
        chrome.storage.local.set({ user, accessToken: tokens.accessToken });
      }
    };

    window.addEventListener('message', handleMessage);

    // Listen for background script messages (e.g., token expiration)
    const handleChromeMessage = (message: any) => {
      if (message.type === 'AUTH_ERROR') {
        console.warn('[Auth] Auth error received from background, signing out...');
        setUser(null);
        setAccessToken(null);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleChromeMessage);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleChromeMessage);
      }
    };
  }, []);

  const signIn = async (provider: 'google' | 'github') => {
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const dynamicApiUrl = await getApiUrl();
    const cacheBuster = Date.now();
    const popupUrl = `${dynamicApiUrl}/oauth/auth/${provider}?cb=${cacheBuster}`;
    console.log(`[Auth] Opening popup: ${popupUrl}`);

    window.open(
      popupUrl,
      'extenda_auth',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,toolbar=no,menubar=no,location=no`
    );
  };

  const signOut = async () => {
    setUser(null);
    setAccessToken(null);
    await chrome.storage.local.remove(['user', 'accessToken']);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoaded, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
