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
    permission?: PermissionLevel; // Added for dynamic manifest support
}

export interface Adapter {
    id: string; // e.g. 'browser_core'
    name: string;
    description: string;
    icon?: string;
    type: 'built-in' | 'oauth';
    provider?: string; // e.g. 'google' for OAuth
    actions: ToolAction[];
    isConnected?: boolean; // Added for dynamic manifest support
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
            { id: 'list_emails', name: 'List Emails', description: 'Fetch and summarize recent email threads.', defaultPermission: 'allowed' },
            { id: 'send_email', name: 'Send Email', description: 'Compose and send emails on your behalf.', defaultPermission: 'approval_required' }
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
            { id: 'list_events', name: 'View Schedule', description: 'Read upcoming events from your calendar.', defaultPermission: 'allowed' },
            { id: 'create_event', name: 'Create Events', description: 'Add new meetings or events to your schedule.', defaultPermission: 'approval_required' }
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
            { id: 'list_files', name: 'List Files', description: 'Lookup documents and files in your Drive.', defaultPermission: 'allowed' },
            { id: 'create_folder', name: 'Create Folder', description: 'Organize files by creating new directories.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'slack',
        name: 'Slack',
        description: 'Real-time communication and messaging.',
        type: 'oauth',
        provider: 'slack',
        actions: [
            { id: 'send_message', name: 'Send Message', description: 'Post updates to channels or direct messages.', defaultPermission: 'approval_required' },
            { id: 'get_history', name: 'Read History', description: 'Retrieve message history from conversations.', defaultPermission: 'allowed' }
        ]
    },
    {
        id: 'jira',
        name: 'Jira',
        description: 'Issue tracking and project management.',
        type: 'oauth',
        provider: 'jira',
        actions: [
            { id: 'search_issues', name: 'Search Issues', description: 'Find tickets using JQL or keywords.', defaultPermission: 'allowed' },
            { id: 'create_issue', name: 'Create Issue', description: 'Create new tasks, bugs, or stories.', defaultPermission: 'approval_required' },
            { id: 'get_issue', name: 'View Issue', description: 'Read full details of a specific ticket.', defaultPermission: 'allowed' }
        ]
    },
    {
        id: 'notion',
        name: 'Notion',
        description: 'Knowledge base and page management.',
        type: 'oauth',
        provider: 'notion',
        icon: notionIcon,
        actions: [
            { id: 'query_database', name: 'Query Database', description: 'Search and filter Notion databases.', defaultPermission: 'allowed' },
            { id: 'create_page', name: 'Create Page', description: 'Create new pages or database items.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'hubspot',
        name: 'HubSpot',
        description: 'CRM and marketing automation.',
        type: 'oauth',
        provider: 'hubspot',
        actions: [
            { id: 'get_deals', name: 'View Deals', description: 'Read sales pipeline and deal information.', defaultPermission: 'allowed' },
            { id: 'create_contact', name: 'Create Contact', description: 'Add new leads to the CRM.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'asana',
        name: 'Asana',
        description: 'Team task and project tracking.',
        type: 'oauth',
        provider: 'asana',
        icon: asanaIcon,
        actions: [
            { id: 'get_tasks', name: 'List Tasks', description: 'View assigned tasks in projects.', defaultPermission: 'allowed' },
            { id: 'create_task', name: 'Create Task', description: 'Add new tasks to projects.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'clickup',
        name: 'ClickUp',
        description: 'Unified project management platform.',
        type: 'oauth',
        provider: 'clickup',
        actions: [
            { id: 'get_lists', name: 'View Lists', description: 'Browse folders and lists.', defaultPermission: 'allowed' },
            { id: 'create_task', name: 'Create Task', description: 'Create new tasks in a list.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'airtable',
        name: 'Airtable',
        description: 'Relational database and spreadsheet tool.',
        type: 'oauth', // Assuming OAuth via token for now
        actions: [
            { id: 'get_records', name: 'Read Records', description: 'Retrieve rows from an Airtable base.', defaultPermission: 'allowed' },
            { id: 'create_record', name: 'Create Record', description: 'Add new rows to a table.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        description: 'Professional networking and posting.',
        type: 'oauth',
        provider: 'linkedin',
        icon: linkedinIcon,
        actions: [
            { id: 'get_profile', name: 'View Profile', description: 'Read your professional profile details.', defaultPermission: 'allowed' },
            { id: 'create_post', name: 'Create Post', description: 'Share updates on your LinkedIn feed.', defaultPermission: 'approval_required' }
        ]
    },
    {
        id: 'calendly',
        name: 'Calendly',
        description: 'Automated scheduling and booking.',
        type: 'oauth',
        actions: [
            { id: 'list_events', name: 'View Events', description: 'See upcoming scheduled meetings.', defaultPermission: 'allowed' },
            { id: 'get_event_types', name: 'Event Types', description: 'List available booking link types.', defaultPermission: 'allowed' }
        ]
    },
    {
        id: 'hootsuite',
        name: 'Hootsuite',
        description: 'Social media management dashboard.',
        type: 'oauth',
        actions: [
            { id: 'create_message', name: 'Compose Message', description: 'Draft and schedule social media posts.', defaultPermission: 'approval_required' }
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
