import { createHash } from 'node:crypto';

// Unknown operations require review. Classify the actual dispatcher action as well as its alias.
export function needsApproval(tool: string, params: Record<string, any> = {}) {
    if (['FormAnswers', 'AIProcessor', 'Notifier', 'LinkedInAdapter_save_draft',
        'Tab Management_List All Tabs', 'System Utilities_Send Notifications'].includes(tool)) return false;
    if (tool === 'DOMReader') return !['inspect_form','get_metadata'].includes(params.action);
    if (tool === 'TabManager')
        return !['get_active_tab', 'list', 'list_tabs', 'switch', 'switch_tab'].includes(params.action);

    // Text filters, URLs and record identifiers can disclose personal information to a provider.
    // Only argument-free listing on an explicitly supported connection is automatically safe.
    const safeListings = ['GmailAdapter_list_emails','GmailAdapter_list_labels','GoogleDriveAdapter_list_files',
        'GoogleCalendarAdapter_list_events','GoogleCalendarAdapter_list_calendars','SlackAdapter_list_channels',
        'LinkedInAdapter_list_posts','LinkedInAdapter_get_profile','AsanaAdapter_list_projects',
        'JiraAdapter_list_projects','HubSpotAdapter_list_companies','ClickUpAdapter_get_teams',
        'CalendlyAdapter_get_event_types','CalendlyAdapter_list_events'];
    return !safeListings.includes(tool) || Object.keys(params).length > 0;
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
