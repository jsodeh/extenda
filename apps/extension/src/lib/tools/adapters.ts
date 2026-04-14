import googleIcon from '../../assets/google.png';
import githubIcon from '../../assets/github.png';
import asanaIcon from '../../assets/asana.png';
import notionIcon from '../../assets/notion.png';
import gmailIcon from '../../assets/gmail.png'; // Reusing icons where available
import linkedinIcon from '../../assets/linkedin.png';

export type PermissionLevel = 'allowed' | 'approval_required' | 'disabled';

export interface ToolAction {
    id: string; // The internal tool name (e.g. 'smart_click')
    name: string; // Visual name (e.g. 'Smart Click')
    description: string;
    defaultPermission: PermissionLevel;
}

export interface Adapter {
    id: string; // e.g. 'browser_core'
    name: string;
    description: string;
    icon?: string;
    type: 'built-in' | 'oauth';
    provider?: string; // e.g. 'google' for OAuth
    actions: ToolAction[];
}

export const ADAPTERS: Adapter[] = [
    {
        id: 'browser_interaction',
        name: 'Browser Interaction',
        description: 'Ability to interact with web pages you visit.',
        type: 'built-in',
        actions: [
            { id: 'read_page', name: 'Read Page Content', description: 'Analyze the text and elements of the active tab.', defaultPermission: 'allowed' },
            { id: 'smart_click', name: 'Smart Click', description: 'Click buttons or links based on your instructions.', defaultPermission: 'approval_required' },
            { id: 'fill_form', name: 'Fill Forms', description: 'Type data into input fields and forms.', defaultPermission: 'approval_required' },
            { id: 'screenshot', name: 'Take Screenshot', description: 'Capture a visual image of the current page.', defaultPermission: 'allowed' }
        ]
    },
    {
        id: 'browser_tabs',
        name: 'Tab Management',
        description: 'Control and navigate between your browser tabs.',
        type: 'built-in',
        actions: [
            { id: 'open_tab', name: 'Open New Tab', description: 'Launch a new website in a new tab.', defaultPermission: 'allowed' },
            { id: 'switch_tab', name: 'Switch Tabs', description: 'Move focus to a different open tab.', defaultPermission: 'allowed' },
            { id: 'close_tab', name: 'Close Tab', description: 'Close the active or background tabs.', defaultPermission: 'approval_required' },
            { id: 'list_tabs', name: 'List All Tabs', description: 'See a list of all your currently open tabs.', defaultPermission: 'allowed' }
        ]
    },
    {
        id: 'gmail',
        name: 'Gmail',
        description: 'Advanced email automation and drafting.',
        type: 'oauth',
        provider: 'google',
        icon: gmailIcon,
        actions: [
            { id: 'get_emails', name: 'Read Emails', description: 'Fetch and summarize recent email threads.', defaultPermission: 'allowed' },
            { id: 'send_email', name: 'Send/Draft Email', description: 'Compose and send emails on your behalf.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'google_calendar',
        name: 'Google Calendar',
        description: 'Schedule management and event tracking.',
        type: 'oauth',
        provider: 'google',
        icon: googleIcon,
        actions: [
            { id: 'get_calendar_events', name: 'View Schedule', description: 'Read upcoming events from your calendar.', defaultPermission: 'allowed' },
            { id: 'create_calendar_event', name: 'Create Events', description: 'Add new meetings or events to your schedule.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'google_drive',
        name: 'Google Drive',
        description: 'File search and organization.',
        type: 'oauth',
        provider: 'google',
        icon: googleIcon,
        actions: [
            { id: 'search_drive', name: 'Search Files', description: 'Lookup documents and files in your Drive.', defaultPermission: 'allowed' }
        ]
    },
    {
        id: 'github',
        name: 'GitHub',
        description: 'Code and repository automation.',
        type: 'oauth',
        provider: 'github',
        icon: githubIcon,
        actions: [
            { id: 'list_issues', name: 'List Issues', description: 'See open issues and pull requests.', defaultPermission: 'allowed' },
            { id: 'create_issue', name: 'Create Issues', description: 'Open new issues in repositories.', defaultPermission: 'approval_required' },
            { id: 'review_pr', name: 'Review PRs', description: 'Post comments or reviews on pull requests.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'notion',
        name: 'Notion',
        description: 'Knowledge base and page management.',
        type: 'oauth',
        provider: 'google', // Placeholder until notion-oauth is ready
        icon: notionIcon,
        actions: [
            { id: 'read_page', name: 'Read Notion Page', description: 'Import content from your Notion workspace.', defaultPermission: 'allowed' },
            { id: 'append_content', name: 'Append to Page', description: 'Add notes or items to existing Notion pages.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'system_utils',
        name: 'System Utilities',
        description: 'General system helper functions.',
        type: 'built-in',
        actions: [
            { id: 'notify', name: 'Send Notifications', description: 'Show desktop alerts when tasks are done.', defaultPermission: 'allowed' },
            { id: 'get_current_time', name: 'Check Time', description: 'Access current date and time information.', defaultPermission: 'allowed' }
        ]
    }
];
