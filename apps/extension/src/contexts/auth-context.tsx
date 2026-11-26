import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const loginPopup=useRef<Window|null>(null);
  const loginOrigin=useRef('');
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load auth state from storage on mount
    chrome.storage.local.get(['user', 'accessToken'], (result) => {
      if (result.user && result.accessToken) {
        void chrome.storage.local.set({extenda_model_owner:result.user.id});
        setUser(result.user);
        setAccessToken(result.accessToken);
      }
      setIsLoaded(true);
    });

    const syncAccount=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{
      if(area==='local' && ('user' in changes || 'accessToken' in changes)){
        void chrome.storage.local.get(['user','accessToken']).then(result=>{
          setUser(result.user && result.accessToken ? result.user : null);
          setAccessToken(result.user ? result.accessToken || null : null);
        });
      }
    };
    chrome.storage.onChanged.addListener(syncAccount);

    // Listen for OAuth messages from the popup
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin===loginOrigin.current && loginPopup.current && event.source===loginPopup.current && event.data?.type === 'oauth_success' && event.data.tokens?.accessToken) {
        const { user, tokens } = event.data;
        loginPopup.current=null;
        const modelKeys=['extenda_provider_keys','extenda_active_provider','extenda_default_models','extenda_ollama_url'];
        const savedKey='extenda_models_'+user.id;
        const existing=await chrome.storage.local.get(['extenda_model_owner','user',savedKey,...modelKeys]);
        const previous=existing.extenda_model_owner || existing.user?.id;
        const update:Record<string,unknown>={user,accessToken:tokens.accessToken,extenda_model_owner:user.id};
        if (previous!==user.id) {
          if (previous) update['extenda_models_'+previous]=Object.fromEntries(modelKeys.map(k=>[k,existing[k] ?? null]));
          for (const key of modelKeys) update[key]=existing[savedKey]?.[key] ?? null;
        }
        await chrome.storage.local.set(update);
        setUser(user);
        setAccessToken(tokens.accessToken);
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
      chrome.storage.onChanged.removeListener(syncAccount);
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
    const popupUrl = `${dynamicApiUrl}/oauth/auth/${provider}?cb=${cacheBuster}&origin=${encodeURIComponent(window.location.origin)}`;
    console.log(`[Auth] Opening popup: ${popupUrl}`);

    loginOrigin.current=new URL(dynamicApiUrl).origin;
    loginPopup.current=window.open(
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
