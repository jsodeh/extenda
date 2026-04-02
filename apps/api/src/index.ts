
// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load env before other imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Imports
import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Server } from 'socket.io';
import { EVENTS_CLIENT, EVENTS_SERVER, WorkflowStartPayload, WorkflowApprovePayload, Execution } from '@extenda/shared';
import { eq } from 'drizzle-orm';
import { runMigrations } from './db/migrate.js';
import app from './server.js';
import { orchestrator } from './services/orchestrator.js';
import { intentClassifier } from './services/intent-classifier.js';
import { generateText } from './lib/gemini.js';
import { verifyClerkToken, clerkClient } from './lib/clerk.js';
import { db } from './db/index.js';
import { users, executions, workflows } from './db/schema.js';
import { oauthManager } from './services/oauth-manager.js';
import { chatService } from './services/chat-service.js';

// Debug: Verify env vars are loaded
console.log('App starting...');
console.log('Loading .env from:', envPath);
console.log('Environment:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

const port = Number(process.env.PORT) || 3000;

app.use('*', cors({
    origin: (origin) => {
        const allowed = [
            'chrome-extension://cdbfohlcjpcmejchgkgookcoeffniggc',
            'http://localhost:3000',
            'http://localhost:5173'
        ];
        if (!origin || allowed.includes(origin)) return origin;
        return allowed[0]; // Fallback
    },
    credentials: true,
}));

// Migrations handled by runMigrations() in serve callback or elsewhere
// console.log('Skipping top-level migration check...');

console.log(`Initializing server on port ${port}...`);

// Initialize Socket.IO
const server = serve({
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0'
}, async (info) => {
    // Run migrations on startup
    try {
        await runMigrations();
    } catch (e) {
        console.error('Migration failed:', e);
    }
    console.log(`Listening on http://${info.address}:${info.port}`);
});
console.log('Server initialized.');

const io = new Server(server, {
    cors: {
        origin: "*",
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
    console.error('Failed to configure orchestrator:', err);
}




// Socket Authentication Middleware
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            console.log('Socket connection rejected: No token');
            return next(new Error('Authentication error - No token provided'));
        }

        // Verify Clerk JWT
        const payload = await verifyClerkToken(token);
        const clerkUserId = payload.sub;

        // Fetch user from DB by clerkId
        let user = await db.query.users.findFirst({
            where: eq(users.clerkId, clerkUserId)
        });

        if (!user) {
            console.log('Auto-provisioning new user for Clerk ID:', clerkUserId);
            // Fetch profile data from Clerk
            const clerkUser = await clerkClient.users.getUser(clerkUserId!);
            const email = clerkUser.emailAddresses[0]?.emailAddress;
            const name = clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : (email?.split('@')[0] || 'User');

            // Create user record
            const [newUser] = await db.insert(users).values({
                clerkId: clerkUserId,
                email: email || '',
                name: name,
                onboardingCompleted: false
            }).returning();
            
            user = newUser;
        }

        // Attach user to socket
        (socket as any).user = user;
        next();
    } catch (err) {
        console.error('Socket connection rejected (Clerk Error):', err);
        next(new Error('Authentication error - Invalid Clerk session'));
    }
});

io.on('connection', (socket) => {
    const user = (socket as any).user;
    console.log('Client connected:', socket.id, 'User:', user.email);

    // Join user-specific room so all user's sockets (sidepanel + background) receive events
    socket.join(`user:${user.id}`);
    console.log(`Socket ${socket.id} joined room user:${user.id}`);

    // ...

    socket.on(EVENTS_CLIENT.WORKFLOW_START, async (data: WorkflowStartPayload) => {
        console.log('Received workflow start request:', data);

        // Safety timeout for entire request
        const timeoutHandle = setTimeout(() => {
            console.error('[TIMEOUT] Request exceeded 60s limit');
            socket.emit(EVENTS_SERVER.WORKFLOW_ERROR, { error: 'Request timeout - please try again' });
        }, 60000);

        try {
            // OPTIMIZATION 1: Quick Match First (no infrastructure delays for greetings)
            console.log('[DEBUG] 0. Running quick intent match...');
            const quickClassification = await intentClassifier.classify(data.intent, []);
            console.log('[DEBUG] 0.1. Quick classification:', quickClassification.type);

            if (quickClassification.type === 'conversational' && quickClassification.confidence === 1.0) {
                // FAST PATH: Instant greeting response
                console.log('[DEBUG] Quick greeting detected, skipping heavy checks');

                // Emit typing status IMMEDIATELY so user sees feedback
                socket.emit('agent:status', { state: 'responding', message: 'Typing response...' });

                // Create or use session asynchronously
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
                socket.join(sessionId);

                // Add user message
                await orchestrator.addMessage(sessionId, 'user', data.intent);

                // Generate friendly response - concise for greetings
                const chatPrompt = `You are Extenda, a friendly AI Executive Assistant.

The user said: "${data.intent}"

RULES:
- For greetings (hi, hello, hey, thanks), respond in ONE short sentence. Example: "Hello! How can I help you today?"
- NEVER list your capabilities unless the user explicitly asks "what can you do?"
- Be warm but concise - maximum 2 sentences.
- Do NOT mention adapters, tools, or technical details unless asked.
`;
                const response = await generateText(chatPrompt);

                // Add assistant response to history
                await orchestrator.addMessage(sessionId, 'assistant', response);

                // Emit response
                socket.emit('chat:response', { message: response, sessionId });
                socket.emit('agent:status', { state: 'idle', message: 'Ready' });

                clearTimeout(timeoutHandle);
                return; // DONE - no workflow needed
            }

            // TIER 2: Simple Commands - Direct Execution
            if (quickClassification.type === 'simple_command' && quickClassification.tool) {
                console.log('[DEBUG] Simple command detected:', quickClassification.tool);

                socket.emit('agent:status', { state: 'executing', message: 'Executing...' });

                try {
                    // Create session if needed
                    let sessionId = data.sessionId;
                    if (!sessionId) {
                        const session = await chatService.createSession(user.id);
                        sessionId = session.id;
                        socket.emit('session:created', { sessionId });
                    }
                    socket.join(sessionId);

                    // Add user message
                    await orchestrator.addMessage(sessionId, 'user', data.intent);

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
                    console.error('[ERROR] Simple command execution failed:', error);
                    const errorMessage = `❌ Failed: ${(error as Error).message}`;
                    socket.emit('chat:response', { message: errorMessage, sessionId: data.sessionId });
                    socket.emit('agent:status', { state: 'error', message: 'Execution failed' });
                    clearTimeout(timeoutHandle);
                    return;
                }
            }

            // TIER 3: Complex Workflows - Full Orchestration
            // Notify user that processing has started
            socket.emit('agent:status', { state: 'thinking', message: 'Analyzing request...' });
            console.log('[DEBUG] 1. Status emitted');

            // OPTIMIZATION 2: Lazy OAuth - only for workflow intents
            console.log('[DEBUG] 2. Checking tokens for workflow...');
            const validUser = await oauthManager.ensureValidToken(user);
            console.log('[DEBUG] 3. Tokens valid');

            // Create or use session
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
            console.log('[DEBUG] 4. Session ID:', sessionId);

            // Join the session room for real-time updates
            socket.join(sessionId);

            // Context for tools (tokens)
            const context = {
                timestamp: new Date(),
                tokens: {
                    access_token: validUser.googleAccessToken,
                    refresh_token: validUser.googleRefreshToken
                }
            };

            // Get conversation history for intent classification
            console.log('[DEBUG] 5. Fetching history...');
            const conversationHistory = await orchestrator.getConversationHistory(sessionId);
            console.log('[DEBUG] 6. History fetched');

            // Add user message to history
            console.log('[DEBUG] 7. Adding user message...');
            await orchestrator.addMessage(sessionId, 'user', data.intent);
            console.log('[DEBUG] 8. User message added');

            // Workflow planning
            socket.emit('agent:status', { state: 'planning', message: 'Designing workflow...' });

            const workflowIntent = quickClassification.workflowIntent || data.intent;
            const workflow = await orchestrator.plan(workflowIntent, user, sessionId);

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
                    sessionId: sessionId
                },
                result: undefined,
                error: undefined
            };

            // Store workflow for resume capability
            (execution as any)._workflow = workflow;

            // Execute with approval required based on AI planning
            orchestrator.execute(execution, workflow, workflow.definition.requiresApproval).catch(err => {
                console.error('Execution error:', err);
                socket.emit('agent:status', { state: 'error', message: 'Execution failed' });
            });

            clearTimeout(timeoutHandle);
        } catch (error) {
            clearTimeout(timeoutHandle);
            console.error('Workflow start failed:', error);
            socket.emit(EVENTS_SERVER.WORKFLOW_ERROR, { error: `Failed to start: ${(error as Error).message}` });
        }
    });

    socket.on(EVENTS_CLIENT.WORKFLOW_RESUME, async (data: { executionId: string; approved: boolean }) => {
        console.log('Received workflow resume request:', data);
        try {
            await orchestrator.resume(data.executionId, data.approved);
        } catch (error) {
            console.error('Workflow resume failed:', error);
            socket.emit(EVENTS_SERVER.WORKFLOW_ERROR, { error: `Failed to resume: ${(error as Error).message}` });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// DEBUG: Temporary endpoints to troubleshoot migration failure
app.get('/api/debug/info', async (c) => {
    try {
        const { fileURLToPath } = await import('url');
        const { dirname, resolve } = await import('path');
        const { readdir } = await import('fs/promises');

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const migrationsPath = resolve(__dirname, '../migrations'); // assuming dist/index.js -> dist/../migrations = migrations

        let files: string[] = [];
        try {
            files = await readdir(migrationsPath);
        } catch (e) {
            files = [`Error reading dir: ${(e as Error).message}`];
        }

        return c.json({
            cwd: process.cwd(),
            __dirname,
            migrationsPath,
            files
        });
    } catch (e) {
        return c.json({ error: (e as Error).message }, 500);
    }
});

app.post('/api/debug/force-sync', async (c) => {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS "chat_sessions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
                "title" TEXT NOT NULL DEFAULT 'New Chat',
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS "chat_messages" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "session_id" UUID REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
                "role" TEXT NOT NULL,
                "content" TEXT NOT NULL,
                "metadata" JSONB,
                "created_at" TIMESTAMP DEFAULT NOW()
            );
        `;
        // Execute raw SQL using Drizzle's db instance if it exposes execute, or raw client
        // Using the pg client directly via db session if possible, or just re-importing pool
        // Since we don't have direct access to pool here easily, let's use db.execute if using postgresjs or aws-data-api, 
        // but for node-postgres it's usually db.execute(sql`...`). 
        // Let's assume db.execute works with sql template tag.

        // Actually, db.execute is for prepared statements. 
        // Let's try to import the pool or just use a new client for this debug hack.

        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        await pool.query(sql);
        await pool.end();

        return c.json({ status: 'Tables created manually' });
    } catch (e) {
        return c.json({ error: (e as Error).message }, 500);
    }
});

// REST Routes
app.get('/api/history', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);

        const token = authHeader.split(' ')[1];
        const payload = await verifyClerkToken(token);
        const clerkUserId = payload.sub;
        if (!clerkUserId) return c.json({ error: 'Unauthorized' }, 401);

        const dbUser = await db.query.users.findFirst({
            where: eq(users.clerkId, clerkUserId)
        });
        if (!dbUser) return c.json({ error: 'User not found' }, 404);
        const userId = dbUser.id;

        const userExecutions = await db.query.executions.findMany({
            where: eq(executions.userId, userId as any),
            orderBy: (executions, { desc }) => [desc(executions.startedAt)],
            limit: 20,
            with: {
                // @ts-ignore
                workflow: true
            }
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
                    where: eq(workflows.id, exec.workflowId as any)
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

    } catch (error) {
        console.error('History fetch error:', error);
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

app.get('/api/chat/sessions', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);

        const token = authHeader.split(' ')[1];
        const payload = await verifyClerkToken(token);
        const clerkUserId = payload.sub;
        if (!clerkUserId) return c.json({ error: 'Unauthorized' }, 401);

        const dbUser = await db.query.users.findFirst({
            where: eq(users.clerkId, clerkUserId)
        });
        if (!dbUser) return c.json({ error: 'User not found' }, 404);
        const userId = dbUser.id;
        const sessions = await chatService.getSessions(userId);
        return c.json(sessions);
    } catch (error) {
        console.error('Chat sessions fetch error:', error);
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

app.get('/api/chat/sessions/:sessionId', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);

        const sessionId = c.req.param('sessionId');
        const messages = await chatService.getMessages(sessionId);
        return c.json(messages);
    } catch (error) {
        console.error('Chat messages fetch error:', error);
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

app.post('/api/chat/sessions', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);

        const token = authHeader.split(' ')[1];
        const payload = await verifyClerkToken(token);
        const clerkUserId = payload.sub;
        if (!clerkUserId) return c.json({ error: 'Unauthorized' }, 401);

        const dbUser = await db.query.users.findFirst({
            where: eq(users.clerkId, clerkUserId)
        });
        if (!dbUser) return c.json({ error: 'User not found' }, 404);
        const userId = dbUser.id;
        const session = await chatService.createSession(userId);
        return c.json(session);
    } catch (error) {
        console.error('Create chat session error:', error);
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

export { io };
