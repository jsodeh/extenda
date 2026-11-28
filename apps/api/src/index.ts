import './env.js';
import { WorkflowPersistence } from './services/workflow-persistence.js';
import { needsApproval } from './lib/approval.js';
// Imports
import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Server } from 'socket.io';
import { EVENTS_CLIENT, EVENTS_SERVER, WorkflowStartPayload, WorkflowApprovePayload, WorkflowResumePayload, Execution } from '@extenda/shared';
import { eq, and, desc, sql } from 'drizzle-orm';
import { runMigrations } from './db/migrate.js';

import app from './server.js';
import { orchestrator } from './services/orchestrator.js';
import { intentClassifier } from './services/intent-classifier.js';
import { generateText } from './lib/models.js';
import { verify } from 'hono/jwt';
import { authMiddleware, allowedExtensionOrigin, AuthEnv } from './lib/auth.js';
import { authOAuth } from './routes/auth-oauth.js';
import { db,pool } from './db/index.js';
import { users, executions, workflows } from './db/schema.js';
import { chatService } from './services/chat-service.js';

const port = Number(process.env.PORT) || 3000;

// Migrations handled by runMigrations() in serve callback or elsewhere
// console.log('Skipping top-level migration check...');

console.log(`Initializing server on port ${port}...`);

// Initialize Socket.IO
await runMigrations();
await WorkflowPersistence.recoverInterrupted();
const server = serve({
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0'
}, async (info) => {
    console.log(`Listening on http://${info.address}:${info.port}`);
});
console.log('Server initialized.');

const io = new Server(server, {
    cors: {
        origin: (origin, done) => done(null, !origin || allowedExtensionOrigin(origin)),
        methods: ["GET", "POST"]
    },
    pingTimeout: 120000,      // 120s - double default, prevents disconnects during long ops
    pingInterval: 25000,      // 25s - send keepalive pings every 25s
    transports: ['websocket', 'polling']
});

// Pass IO instance to orchestrator
try {
    orchestrator.setServer(io);
    console.log('Orchestrator configured.');
} catch (err) {
    console.error('Failed to configure orchestrator');
}




// Socket Authentication Middleware
io.use(async (socket, next) => {
    try {
        const origin = socket.handshake.headers.origin;
        if (origin && !allowedExtensionOrigin(origin)) return next(new Error('Unregistered extension origin'));
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            console.log('Socket connection rejected: No token');
            return next(new Error('Authentication error - No token provided'));
        }

        // Verify JWT
        const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET must be configured');
        const payload = await verify(token, jwtSecret, 'HS256');
        const userId = payload.userId as string;

        if (!userId || payload.type==='refresh') {
            console.log('Socket connection rejected: Invalid payload');
            return next(new Error('Authentication error - Invalid token payload'));
        }

        // Fetch user from DB by ID
        const user = await db.query.users.findFirst({
            columns: {id:true},
            where: eq(users.id, userId)
        });

        if (!user) {
            console.log('Socket connection rejected: User not found', userId);
            return next(new Error('Authentication error - User session invalid'));
        }

        // Attach user to socket
        socket.data.expiresAt=Number(payload.exp)*1000;
        (socket as any).user = user;
        next();
    } catch (err) {
        console.error('Socket connection rejected (JWT/Auth Error)');
        next(new Error('Authentication error - Session verification failed'));
    }
});

io.on('connection', (socket) => {
    const user = (socket as any).user;

    const browser=socket.handshake.auth.role==='browser';
    socket.use(([event],next)=>{
        if (Date.now()>=socket.data.expiresAt) {socket.disconnect(true);return;}
        if (browser && event.startsWith('workflow:')) return next(new Error('Review workflows in the side panel'));
        next();
    });
    if (Number.isFinite(socket.data.expiresAt)) {
        const expiry=setTimeout(()=>socket.disconnect(true),Math.min(2147483647,socket.data.expiresAt-Date.now()));
        socket.once('disconnect',()=>clearTimeout(expiry));
    }
    socket.join(browser ? `browser:${user.id}` : `user:${user.id}`);

    if (socket.handshake.auth.role !== 'browser') {
        const restoreReview=async(sessionId?:string)=>{
            if (sessionId) {
                if ((await chatService.getSession(sessionId))?.userId!==user.id) return;
                await socket.join(sessionId);
            }
            const [run]=await db.select().from(executions).where(and(eq(executions.userId,user.id),
                eq(executions.status,'paused'),sessionId ? sql`${executions.context}->>'sessionId'=${sessionId}` : undefined))
                .orderBy(desc(executions.startedAt)).limit(1);
            const ctx=run?.context as any;
            if (!ctx?.review || !run.workflowId) return;
            const workflow=await db.query.workflows.findFirst({where:and(eq(workflows.id,run.workflowId),eq(workflows.userId,user.id))});
            if (!workflow) return;
            if (ctx.sessionId && (await chatService.getSession(ctx.sessionId))?.userId===user.id) await socket.join(ctx.sessionId);
            const definition=workflow.definition as any;
            socket.emit(EVENTS_SERVER.WORKFLOW_PLAN,{workflowId:workflow.id,executionId:run.id,status:'paused',approval:ctx.approval,pendingStepId:ctx.review.id,
                plan:{...workflow,definition:{...definition,steps:definition.steps.map((s:any)=>s.id===ctx.review.id ? ctx.review : s)}}});
        };
        void restoreReview().catch(()=>console.error('Failed to restore pending review'));
        socket.on('session:open',(id:unknown)=>{
            if (typeof id==='string') void restoreReview(id).catch(()=>console.error('Failed to open chat session'));
        });
    }
    // Forward tool execution results from background worker to orchestrator
    // CRITICAL: This was missing before — tool:result events from clients were silently dropped
    // because io.on() only handles 'connection' events, not client-emitted events.
    socket.on('tool:result', (data: any) => {
        if (browser && data && typeof data.executionId==='string' && typeof data.stepId==='string')
            orchestrator.handleToolResult(user.id,socket.id,data);
    });

    socket.on(EVENTS_CLIENT.WORKFLOW_START, async (data: WorkflowStartPayload) => {

        let expired = false;
        const timeoutHandle = setTimeout(() => {
            expired = true;
            socket.emit(EVENTS_SERVER.WORKFLOW_ERROR, { error: 'Request timed out. Check workflow history before trying again.' });
        }, 300000);

        try {
            if (!data || typeof data.intent!=='string' || !data.intent.trim() || data.intent.length>200000) throw new Error('Invalid request');
            if (data.requestId) {
                const receipt=await pool.query('INSERT INTO workflow_requests(user_id,request_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.id,data.requestId]);
                if (!receipt.rowCount) { clearTimeout(timeoutHandle); return; }
            }
            // 1. Session & History Initialization (Required for accurate context matching)
            let sessionId = data.sessionId;
            if (!sessionId) {
                // Generate title from user's first message (truncate to 50 chars)
                const title = data.intent.length > 50
                    ? data.intent.substring(0, 47) + '...'
                    : data.intent;
                const session = await chatService.createSession(user.id, title);
                sessionId = session.id;
                socket.emit('session:created', { sessionId });
            }
            if ((await chatService.getSession(sessionId))?.userId !== user.id) throw new Error('Chat session unavailable');
            socket.join(sessionId);

            // Get conversation history BEFORE classification (do not include current message yet)
            console.log('[DEBUG] Fetching history for context...');
            const conversationHistory = await orchestrator.getConversationHistory(sessionId);

            // Add user message to history
            console.log('[DEBUG] Adding user message to history...');
            await orchestrator.addMessage(sessionId, 'user', data.intent);

            // OPTIMIZATION 1: Quick Match First (with full context)
            console.log('[DEBUG] 0. Running quick intent match...');
            const quickClassification = await intentClassifier.classify(data.intent, conversationHistory, data.modelConfig);
            if (expired) return;
            console.log('[DEBUG] 0.1. Quick classification:', quickClassification.type);

            if (quickClassification.type === 'conversational' && quickClassification.confidence === 1.0 && /^(?:hi(?: there)?|hello|hey|greetings|thanks|thank you|ok|okay|great|cool)[!.?]*$/i.test(data.intent.trim()) && !data.context?.attachments?.length) {
                // FAST PATH: Instant greeting response
                console.log('[DEBUG] Quick greeting detected, skipping heavy checks');

                // Emit typing status IMMEDIATELY so user sees feedback
                socket.emit('agent:status', { state: 'responding', message: 'Typing response...' });



                // Generate friendly response - concise for greetings
                const chatPrompt = `You are Extenda, a friendly AI Executive Assistant.

The user said: "${data.intent}"

RULES:
- For greetings (hi, hello, hey, thanks), respond in ONE short sentence. Example: "Hello! How can I help you today?"
- NEVER list your capabilities unless the user explicitly asks "what can you do?"
- Be warm but concise - maximum 2 sentences.
- Do NOT mention adapters, tools, or technical details unless asked.
`;
                const response = await generateText(chatPrompt, data.modelConfig);

                // Add assistant response to history
                await orchestrator.addMessage(sessionId, 'assistant', response);

                // Emit response
                socket.emit('chat:response', { message: response, sessionId });
                socket.emit('agent:status', { state: 'idle', message: 'Ready' });

                clearTimeout(timeoutHandle);
                return; // DONE - no workflow needed
            }

            // TIER 2: Simple Commands - Direct Execution
            if (quickClassification.type === 'simple_command' && quickClassification.tool && !needsApproval(quickClassification.tool, quickClassification.params)) {
                console.log('[DEBUG] Simple command detected:', quickClassification.tool);

                socket.emit('agent:status', { state: 'executing', message: 'Executing...' });

                try {


                    // Direct execution - no workflow needed
                    const result = await orchestrator.executeDirectCommand({
                        tool: quickClassification.tool,
                        params: quickClassification.params,
                        userId: user.id,
                        sessionId: sessionId,
                        socket: socket  // Pass socket instance for targeted delivery
                    });

                    // Generate success message
                    let successMessage = '✅ Done!';
                    if (quickClassification.tool === 'TabManager') {
                        if (quickClassification.params?.action === 'open') {
                            successMessage = `✅ Opened ${quickClassification.params.url}`;
                        } else if (quickClassification.params?.action === 'close') {
                            successMessage = '✅ Tab closed';
                        }
                    } else if (quickClassification.tool === 'Notifier') {
                        successMessage = '✅ Notification shown';
                    }

                    // Add success to history
                    await orchestrator.addMessage(sessionId, 'assistant', successMessage);

                    // Emit success response
                    socket.emit('chat:response', { message: successMessage, sessionId });
                    socket.emit('agent:status', { state: 'idle', message: 'Ready' });

                    clearTimeout(timeoutHandle);
                    return; // DONE - direct execution complete
                } catch (error) {
                    console.error('[ERROR] Simple command execution failed');
                    const errorMessage = `❌ Failed: ${(error as Error).message}`;
                    socket.emit('chat:response', { message: errorMessage, sessionId });
                    socket.emit('agent:status', { state: 'error', message: 'Execution failed' });
                    clearTimeout(timeoutHandle);
                    return;
                }
            }

            // TIER 3: Complex Workflows - Full Orchestration
            // Notify user that processing has started
            socket.emit('agent:status', { state: 'thinking', message: 'Analyzing request...' });
            console.log('[DEBUG] 1. Status emitted');

            const context = {timestamp:new Date(), modelConfig:data.modelConfig};

            // Workflow planning
            socket.emit('agent:status', { state: 'planning', message: 'Designing workflow...' });

            const workflowIntent = data.intent;
            const workflow = await orchestrator.plan(workflowIntent, user, sessionId, data.modelConfig, data.context?.form, Array.isArray(data.context?.attachments) ? data.context.attachments.filter((a:unknown)=>typeof a==='string').slice(0,10) : undefined);

            if (expired) return;
            // TIER 3.5: Direct Response Check
            // If the AI determined it can answer directly without any steps, we skip the workflow
            if (workflow.definition.directResponse && (!workflow.definition.steps || workflow.definition.steps.length === 0)) {
                console.log('[DEBUG] AI provided direct response, skipping workflow execution');
                
                // Add assistant response to history
                await orchestrator.addMessage(sessionId, 'assistant', workflow.definition.directResponse);

                // Emit response
                socket.emit('chat:response', { message: workflow.definition.directResponse, sessionId });
                socket.emit('agent:status', { state: 'idle', message: 'Ready' });

                clearTimeout(timeoutHandle);
                return; // DONE
            }

            // Add workflow plan to history with steps in metadata
            await orchestrator.addMessage(sessionId, 'assistant', `Created workflow with ${workflow.definition.steps.length} steps`, {
                workflowId: workflow.id,
                workflow: {
                    id: workflow.id,
                    steps: workflow.definition.steps.map(s => ({
                        id: s.id,
                        tool: s.tool,
                        description: s.description || `Execute ${s.tool}`,
                        params: s.params,
                        status: 'pending'
                    }))
                }
            });

            const execution: Execution = {
                id: randomUUID(),
                workflowId: workflow.id,
                userId: user.id,
                status: 'pending',
                startedAt: new Date(),
                steps: workflow.definition.steps.map(s => ({
                    stepId: s.id,
                    status: 'pending',
                    retryCount: 0
                })),
                context: {
                    ...context,
                    sessionId: sessionId, browserTarget: data.context?.browserTarget
                },
                result: undefined,
                error: undefined
            };

            // Store workflow for resume capability

            // Execute with approval required based on AI planning
            if (expired) return;
            orchestrator.execute(execution, workflow, workflow.definition.requiresApproval, data.modelConfig).catch(err => {
                console.error('Execution error');
                socket.emit('agent:status', { state: 'error', message: 'Execution failed' });
            });

            clearTimeout(timeoutHandle);
        } catch (error) {
            clearTimeout(timeoutHandle);
            console.error('Workflow start failed',socket.id);
            socket.emit(EVENTS_SERVER.WORKFLOW_ERROR, { error: `Failed to start: ${(error as Error).message}` });
        }
    });

    socket.on(EVENTS_CLIENT.WORKFLOW_CANCEL,async (data)=>{
        try {
            if (typeof data?.executionId !== 'string') throw new Error('Invalid execution');
            await orchestrator.cancel(data.executionId,user.id);
        }
        catch {socket.emit(EVENTS_SERVER.WORKFLOW_ERROR,{error:'No cancellable workflow'});}
    });
    socket.on(EVENTS_CLIENT.WORKFLOW_RESUME, async (data: WorkflowResumePayload) => {
        try {
            await orchestrator.resume(data.executionId, user.id, data.approved, data.approval, data.modelConfig, data.revised);
        } catch (error) {
            console.error('Workflow resume failed',socket.id);
            socket.emit(EVENTS_SERVER.WORKFLOW_ERROR, { error: `Failed to resume: ${(error as Error).message}` });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// REST Routes
app.get('/api/history', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const userId = user.id;

        const userExecutions = await db.query.executions.findMany({
            where: eq(executions.userId, userId as any),
            orderBy: (executions, { desc }) => [desc(executions.startedAt)],
            limit: 20,

        });

        // Manual join if relation not set up in schema types correctly, but let's assume it works or try safe fallback
        // Since we didn't inspect relations.ts, safer to fetch workflows manually or just try.
        // If relations fail, we map.

        const history = await Promise.all(userExecutions.map(async (exec) => {
            let workflowName = 'Unknown Workflow';
            let stepsCount = 0;

            // Try to get from relation
            if ((exec as any).workflow) {
                workflowName = (exec as any).workflow.intent;
                stepsCount = (exec as any).workflow.definition.steps.length;
            } else {
                // Fallback fetch
                const wf = await db.query.workflows.findFirst({
                    where: and(eq(workflows.id, exec.workflowId as any),eq(workflows.userId,user.id))
                });
                if (wf) {
                    workflowName = wf.intent;
                    stepsCount = (wf.definition as any).steps?.length || 0;
                }
            }

            return {
                id: exec.id,
                intent: workflowName,
                timestamp: exec.startedAt,
                status: exec.status,
                stepsCount
            };
        }));
        return c.json(history);
    } catch (error) {
        console.error('History fetch error');
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

app.get('/api/chat/sessions', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const userId = user.id;
        const sessions = await chatService.getSessions(userId);
        return c.json(sessions);
    } catch (error) {
        console.error('Chat sessions fetch error');
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

app.get('/api/chat/sessions/:sessionId', authMiddleware, async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);

        const sessionId = c.req.param('sessionId');
        if ((await chatService.getSession(sessionId))?.userId !== c.get('user').id) return c.json({ error: 'Session unavailable' }, 404);
        const messages = await chatService.getMessages(sessionId);
        return c.json(messages);
    } catch (error) {
        console.error('Chat messages fetch error');
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

app.post('/api/chat/sessions', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const userId = user.id;
        const session = await chatService.createSession(userId);
        return c.json(session);
    } catch (error) {
        console.error('Create chat session error');
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

export { io };
