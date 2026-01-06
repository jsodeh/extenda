import { useState } from 'react';
import { Settings, MessageSquare, History, BookOpen, X, FileText, Clock, Settings2, Plus, Menu } from 'lucide-react';

export type Page = 'chat' | 'history' | 'settings' | 'integrations' | 'knowledgebase' | 'templates';

interface NavigationMenuProps {
    currentPage: Page;
    onNavigate: (page: Page) => void;
}

export default function NavigationMenu({ currentPage, onNavigate }: NavigationMenuProps) {
    const [isOpen, setIsOpen] = useState(false);

    const menuItems = [
        { id: 'new_chat' as Page, label: 'New Chat', icon: Plus },
        { id: 'templates' as Page, label: 'Templates', icon: FileText },
        { id: 'history' as Page, label: 'History', icon: History },
        { id: 'settings' as Page, label: 'Settings', icon: Settings },
        { id: 'knowledgebase' as Page, label: 'Knowledgebase', icon: BookOpen },
    ];

    return (
        <>
            {/* Menu Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Menu"
            >
                {isOpen ? (
                    <X className="h-5 w-5 text-gray-600" />
                ) : (
                    <Menu className="h-5 w-5 text-gray-600" />
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-4 top-14 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-[200px]">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPage === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onNavigate(item.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon className="h-5 w-5" />
                                <span className="text-sm font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
