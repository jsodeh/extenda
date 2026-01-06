import { create } from 'zustand';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AppState {
    isMenuOpen: boolean;
    messages: Message[];
    toggleMenu: () => void;
    addMessage: (msg: Message) => void;
    clearHistory: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    isMenuOpen: false,
    messages: [],
    toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    clearHistory: () => set({ messages: [] }),
}));
