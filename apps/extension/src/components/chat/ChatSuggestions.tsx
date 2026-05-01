import React from 'react';
import { Sparkles, MessageSquare, ArrowRight, Lightbulb, Search, Mail } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Suggestion {
    id: string;
    title: string;
    description: string;
    prompt: string;
    icon: React.ElementType;
    color: string;
}

interface ChatSuggestionsProps {
    suggestions: Suggestion[];
    onSelect: (prompt: string) => void;
}

export function ChatSuggestions({ suggestions, onSelect }: ChatSuggestionsProps) {
    return (
        <div className="w-full max-w-lg px-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex overflow-x-auto gap-2.5 pb-2 px-1 no-scrollbar scroll-smooth snap-x">
                {suggestions.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => onSelect(s.prompt)}
                        className="flex-shrink-0 w-28 snap-center group relative flex flex-col items-start p-2 bg-card hover:bg-muted/50 border border-border rounded-xl text-left transition-all hover:border-primary/30 active:scale-[0.97]"
                    >
                        <div className={cn("p-1 rounded-lg mb-1.5 transition-colors", s.color)}>
                            <s.icon className="w-3 h-3" />
                        </div>
                        
                        <h3 className="text-[11px] font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                            {s.title}
                        </h3>
                        <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight opacity-80">
                            {s.description}
                        </p>
                    </button>
                ))}
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {["Summarize page", "Draft email", "Fix calendar"].map((chip) => (
                    <button
                        key={chip}
                        onClick={() => onSelect(chip)}
                        className="px-2 py-0.5 rounded-full bg-muted/20 border border-border hover:border-primary/20 hover:bg-muted text-[9px] font-semibold text-muted-foreground transition-all"
                    >
                        {chip}
                    </button>
                ))}
            </div>
        </div>
    );
}

export const STARTER_SUGGESTIONS: Suggestion[] = [
    {
        id: 'emails',
        title: 'Summarize Emails',
        description: 'Get a quick brief of your last 5 unread messages from Gmail.',
        prompt: 'Summarize my last 5 unread emails from Gmail and highlight urgent items.',
        icon: Mail,
        color: 'bg-blue-50 text-blue-500'
    },
    {
        id: 'calendar',
        title: 'Daily Briefing',
        description: 'Check your calendar for today and list your main meetings.',
        prompt: 'What is on my calendar for today? Give me a concise briefing.',
        icon: Lightbulb,
        color: 'bg-amber-50 text-amber-500'
    },
    {
        id: 'research',
        title: 'Deep Research',
        description: 'Explore a topic across the web and save findings to Knowledge Base.',
        prompt: 'Research the latest trends in Agentic AI and summarize top findings.',
        icon: Search,
        color: 'bg-emerald-50 text-emerald-500'
    },
    {
        id: 'draft',
        title: 'Draft a Response',
        description: 'Reply to professional messages using your custom style.',
        prompt: 'Draft a polite follow-up email for the meeting we had yesterday.',
        icon: MessageSquare,
        color: 'bg-purple-50 text-purple-500'
    }
];
