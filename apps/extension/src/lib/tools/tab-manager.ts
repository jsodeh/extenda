import { Tab } from '@extenda/shared';

export async function handleTabManager(params: any): Promise<any> {
    const { action, ...args } = params;

    switch (action) {
        case 'open':  // Alias from intent classifier
        case 'open_tab':
            return await openTab(args.url);
        case 'close':  // Alias from intent classifier
        case 'close_tab':
            return await closeTab(args.tabId);
        case 'switch_tab':
            return await switchTab(args.tabId);
        case 'get_active_tab':
            return await getActiveTab();
        case 'list_tabs':
            return await listTabs();
        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

async function openTab(url: string): Promise<Tab> {
    const tab = await chrome.tabs.create({ url });
    return mapTab(tab);
}

async function closeTab(tabId: number): Promise<void> {
    await chrome.tabs.remove(tabId);
}

async function switchTab(tabId: number): Promise<Tab> {
    const tab = await chrome.tabs.update(tabId, { active: true });
    return mapTab(tab);
}

async function getActiveTab(): Promise<Tab> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("No active tab found");
    return mapTab(tab);
}

async function listTabs(): Promise<Tab[]> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs.map(mapTab);
}

function mapTab(chromeTab: chrome.tabs.Tab): Tab {
    return {
        id: chromeTab.id!,
        url: chromeTab.url || '',
        title: chromeTab.title || '',
        isActive: chromeTab.active,
        favIconUrl: chromeTab.favIconUrl
    };
}
