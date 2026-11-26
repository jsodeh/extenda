import { createHash } from 'node:crypto';

// Unknown operations require review. Classify the actual dispatcher action as well as its alias.
export function needsApproval(tool: string, params: Record<string, any> = {}) {
    if (['DOMReader', 'FormAnswers', 'AIProcessor', 'GmailScraper', 'Notifier'].includes(tool)) return false;
    if (tool === 'TabManager')
        return !['get_active_tab', 'list', 'list_tabs', 'switch', 'switch_tab'].includes(
            params.action
        );
    if (
        [
            'Browser Interaction_Read Page Content',
            'Tab Management_List All Tabs',
            'System Utilities_Send Notifications'
        ].includes(tool)
    )
        return false;
    const action = tool.split('Adapter_')[1];
    return !action || !/^(get_|list_|search_|free_busy$|save_draft$)/.test(action);
}

export function approvalDigest(
    owner: string,
    execution: string,
    step: { id: string; tool?: string; params?: unknown }
) {
    // JSONB may reorder object keys when the workflow is restored.
    const body = JSON.stringify([owner, execution, step.id, step.tool, step.params], (_, value) =>
        value && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(
                  Object.keys(value)
                      .sort()
                      .map((key) => [key, value[key]])
              )
            : value
    );
    return createHash('sha256').update(body).digest('hex');
}
