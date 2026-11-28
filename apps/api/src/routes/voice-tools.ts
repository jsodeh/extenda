import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { Execution, Workflow } from '@extenda/shared';
import { needsApproval } from '../lib/approval.js';
import { authMiddleware, AuthEnv } from '../lib/auth.js';
import { db } from '../db/index.js';
import { workflows } from '../db/schema.js';
import { chatService } from '../services/chat-service.js';
import { orchestrator } from '../services/orchestrator.js';

const tools = new Hono<AuthEnv>();
tools.use('*', authMiddleware);
const actions: Record<string, string> = {
    send_email: 'GmailAdapter_send_email',
    get_emails: 'GmailAdapter_list_emails',
    create_calendar_event: 'GoogleCalendarAdapter_create_event',
    get_calendar_events: 'GoogleCalendarAdapter_list_events',
    search_drive: 'GoogleDriveAdapter_list_files',
    send_slack_message: 'SlackAdapter_send_message',
    create_notion_page: 'NotionAdapter_create_page'
};
tools.post('/:name', async (c) => {
    const name = c.req.param('name');
    if (!Object.hasOwn(actions, name)) return c.json({ error: 'Unknown voice command' }, 400);
    const { params, sessionId } = await c.req.json();
    const user = c.get('user');
    const session = sessionId
        ? await chatService.getSession(sessionId)
        : await chatService.createSession(user.id, 'Voice commands');
    if (!session || session.userId !== user.id) return c.json({ error: 'Session unavailable' }, 404);
    const step = {
        id: 'voice',
        type: 'tool' as const,
        tool: actions[name],
        requiresApproval: needsApproval(actions[name], params),
        params,
        description: name.replaceAll('_', ' ')
    };
    const workflow: Workflow = {
        id: randomUUID(),
        userId: user.id,
        name: 'Voice command',
        intent: step.description,
        definition: { steps: [step] },
        version: 1,
        isTemplate: false,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    await db.insert(workflows).values(workflow);
    const run: Execution = {
        id: randomUUID(),
        workflowId: workflow.id,
        userId: user.id,
        status: 'pending',
        startedAt: new Date(),
        context: {
            timestamp: new Date(),
            sessionId: session.id
        },
        steps: [{ stepId: step.id, status: 'pending', retryCount: 0 }]
    };
    await orchestrator.execute(run, workflow);
    if (run.status === 'paused')
        return c.json({ status: 'awaiting approval in side panel', executionId: run.id }, 202);
    if (run.steps[0].status !== 'completed')
        return c.json({ error: 'Voice command failed. See workflow details.' }, 422);
    return c.json({ result: run.steps[0].result ?? null });
});
export default tools;
