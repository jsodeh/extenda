-- Workflow templates table
CREATE TABLE IF NOT EXISTS "workflow_templates" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "icon" VARCHAR(50),
    "template" JSONB NOT NULL, -- Workflow definition with parameter placeholders
    "parameters" JSONB DEFAULT '[]', -- Parameter definitions for the template
    "is_public" BOOLEAN DEFAULT true,
    "created_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Insert pre-built templates
INSERT INTO "workflow_templates" ("name", "description", "category", "icon", "template", "parameters") VALUES
('Email Summary', 'Summarize your recent emails using AI', 'email', '📧', 
 '{"steps": [{"id": "step1", "type": "tool", "tool": "GmailScraper", "params": {"action": "get_inbox", "limit": "${count}"}, "description": "Fetch recent emails"}, {"id": "step2", "type": "tool", "tool": "AIProcessor", "params": {"action": "summarize", "content": "${step1.result}"}, "dependencies": ["step1"], "description": "Summarize emails"}]}',
 '[{"name": "count", "type": "number", "description": "Number of emails to summarize", "default": 5}]'),

('Schedule Meeting', 'Create a calendar event for a meeting', 'calendar', '📅',
 '{"steps": [{"id": "step1", "type": "tool", "tool": "GoogleCalendar_create_event", "params": {"title": "${title}", "start_time": "${time}", "duration": 60}, "description": "Create calendar event"}, {"id": "step2", "type": "tool", "tool": "Notifier", "params": {"action": "notify", "title": "Meeting Created", "message": "Your meeting has been scheduled"}, "dependencies": ["step1"], "description": "Notify user"}]}',
 '[{"name": "title", "type": "string", "description": "Meeting title"}, {"name": "time", "type": "string", "description": "Meeting start time (ISO format)"}]'),

('Search and Open Tab', 'Find a tab by query and bring it to front', 'productivity', '🔍',
 '{"steps": [{"id": "step1", "type": "tool", "tool": "TabManager", "params": {"action": "search", "query": "${query}"}, "description": "Search for tab"}, {"id": "step2", "type": "tool", "tool": "TabManager", "params": {"action": "switch", "tabId": "${step1.result.id}"}, "dependencies": ["step1"], "description": "Switch to tab", "condition": {"type": "if", "expression": "${step1.result.found} === true"}}]}',
 '[{"name": "query", "type": "string", "description": "Search query for tab"}]');
