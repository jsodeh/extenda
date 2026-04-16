import { Adapter } from '@extenda/shared';

export class AdapterRegistry {
    private adapters: Map<string, Adapter> = new Map();

    register(adapter: Adapter) {
        this.adapters.set(adapter.name, adapter);
    }

    getAll(): Adapter[] {
        return Array.from(this.adapters.values());
    }
}

export const adapterRegistry = new AdapterRegistry();

// All adapters are now implemented - no skeletons needed

// Register all implemented adapters
import { GmailAdapter } from './gmail.js';
import { SlackAdapter } from './slack.js';
import { JiraAdapter } from './jira.js';
import { AsanaAdapter } from './asana.js';
import { ClickUpAdapter } from './clickup.js';
import { NotionAdapter } from './notion.js';
import { AirtableAdapter } from './airtable.js';
import { HubSpotAdapter } from './hubspot.js';
import { GoogleDriveAdapter } from './google-drive.js';
import { GoogleCalendarAdapter } from './google-calendar.js';
import { CalendlyAdapter } from './calendly.js';
import { BufferAdapter } from './buffer.js';
import { HootsuiteAdapter } from './hootsuite.js';
import { GoogleFormsAdapter } from './google-forms.js';
import { GoogleDocsAdapter } from './google-docs.js';
import { GoogleSheetsAdapter } from './google-sheets.js';
import { LinkedInAdapter } from './linkedin.js';
import { BrowserInteractionAdapter } from './browser-interaction.js';
import { TabManagementAdapter } from './tab-manager.js';
import { SystemUtilsAdapter } from './system-utils.js';

adapterRegistry.register(new GmailAdapter());
adapterRegistry.register(new SlackAdapter());
adapterRegistry.register(new JiraAdapter());
adapterRegistry.register(new AsanaAdapter());
adapterRegistry.register(new ClickUpAdapter());
adapterRegistry.register(new NotionAdapter());
adapterRegistry.register(new AirtableAdapter());
adapterRegistry.register(new HubSpotAdapter());
adapterRegistry.register(new GoogleDriveAdapter());
adapterRegistry.register(new GoogleCalendarAdapter());
adapterRegistry.register(new GoogleDocsAdapter());
adapterRegistry.register(new GoogleSheetsAdapter());
adapterRegistry.register(new CalendlyAdapter());
adapterRegistry.register(new BufferAdapter());
adapterRegistry.register(new HootsuiteAdapter());
adapterRegistry.register(new GoogleFormsAdapter());
adapterRegistry.register(new LinkedInAdapter());

// Built-in Adapters
adapterRegistry.register(new BrowserInteractionAdapter());
adapterRegistry.register(new TabManagementAdapter());
adapterRegistry.register(new SystemUtilsAdapter());
