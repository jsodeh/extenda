# Migrate Extenda API to Vercel Serverless Deployment

The Extenda API currently runs as a long-lived Node.js process (Docker → Cloud Run) using `@hono/node-server` + Socket.IO for real-time communication. Vercel's serverless model has no persistent process, so we need to restructure the API for stateless request handling and replace Socket.IO with an HTTP-based event system.

## User Review Required

> [!IMPORTANT]
> **Database choice**: Vercel serverless functions cannot use `pg.Pool` (connection pooling breaks across cold starts). You need a serverless-compatible PostgreSQL provider. The two best options:
> 1. **Neon** (recommended — generous free tier, built for serverless, `@neondatabase/serverless` driver)
> 2. **Vercel Postgres** (Neon under the hood, tighter Vercel integration, `@vercel/postgres`)
>
> **Which do you already have or prefer?** If you don't have a Postgres database yet, Neon's free tier is easiest to set up.

> [!WARNING]
> **Socket.IO → HTTP Polling**: Vercel serverless cannot maintain WebSocket connections. We'll replace Socket.IO with:
> - **HTTP POST** for sending commands (workflow:start, workflow:resume)
> - **HTTP GET polling** for receiving events (agent:status, chat:response, workflow updates)
> - Events are stored temporarily in the database and polled by the extension
>
> This means **slightly higher latency** (~1-2s polling interval) compared to instant WebSocket pushes. The user experience will still feel responsive for workflow execution.

> [!CAUTION]
> **Client-side tool execution** (TabManager, Notifier, etc.) currently works via Socket.IO bidirectional communication — the server emits `tool:execute` and waits for `tool:result` from the extension's background worker. In the polling model, this roundtrip will go through the database, which adds latency. For the initial migration, this is acceptable. A future upgrade could use Vercel's Edge Runtime with WebSocket support or a dedicated pub/sub service.

---

## Proposed Changes

### API Vercel Adapter & Entry Point

Create a single Vercel serverless function that handles all routes via Hono. Vercel's `api/` directory convention maps files to endpoints — we'll use a catch-all route.

#### [NEW] [index.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/api/index.ts)

New Vercel serverless entry point. This replaces [src/index.ts](file:///c:/Users/DELL/Downloads/Yo%21/Extenda/extenda/apps/api/src/index.ts) for Vercel only (original stays for local dev). Uses `@hono/node-server/vercel` or Hono's built-in Vercel adapter to handle all incoming requests:
- Imports the Hono `app` from [server.ts](file:///c:/Users/DELL/Downloads/Yo%21/Extenda/extenda/apps/api/src/server.ts)
- Mounts the new REST-based workflow/chat endpoints (replacing Socket.IO handlers)
- Exports a `default` handler compatible with Vercel's Node.js runtime

#### [MODIFY] [server.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/src/server.ts)

No structural changes needed — this is already a clean Hono app with routes mounted. We'll add the new polling/event routes here.

#### [NEW] [vercel.json](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/vercel.json)

Vercel project configuration at the monorepo root:
- `"buildCommand"`: Build shared + API packages
- `"outputDirectory"`: Point to API dist
- `"rewrites"`: Route all requests to the catch-all API function
- `"functions"`: Configure max duration (Vercel Pro allows up to 60s, Hobby allows 10s)

---

### Database: Serverless-Compatible Driver

#### [MODIFY] [db/index.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/src/db/index.ts)

Replace `pg.Pool` with `@neondatabase/serverless` (or `@vercel/postgres`):
```diff
-import { drizzle } from 'drizzle-orm/node-postgres';
-import { Pool } from 'pg';
+import { drizzle } from 'drizzle-orm/neon-http';
+import { neon } from '@neondatabase/serverless';

-export const pool = new Pool({
-    connectionString: process.env.DATABASE_URL || '...',
-});
-export const db = drizzle(pool, { schema });
+const sql = neon(process.env.DATABASE_URL!);
+export const db = drizzle(sql, { schema });
```

#### [MODIFY] [db/migrate.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/src/db/migrate.ts)

Update migrator import to use the neon-http migrator. Migrations can be run as a one-off script (not at server startup, since there's no "startup" in serverless).

#### [MODIFY] [package.json](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/package.json)

- Add `@neondatabase/serverless` (or `@vercel/postgres`)
- Add `@hono/node-server` already exists; add vercel-specific adapter if needed
- Remove `socket.io` dependency (not used in Vercel deployment)

---

### Replace Socket.IO with HTTP Event Polling

This is the most significant change. We need to:
1. Add a DB table for transient events
2. Add REST endpoints for workflow commands and event polling
3. Update the orchestrator to write events to DB instead of Socket.IO

#### [NEW] Event Queue Schema

Add `events` table to [schema.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/src/db/schema.ts):
```typescript
export const events = pgTable('events', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    sessionId: text('session_id'),
    type: text('type').notNull(),       // 'agent:status', 'chat:response', 'workflow:plan', etc.
    payload: jsonb('payload'),
    createdAt: timestamp('created_at').defaultNow(),
    consumed: boolean('consumed').default(false),
});
```

#### [NEW] [routes/events.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/src/routes/events.ts)

New route for polling events:
- `GET /api/events?since=<timestamp>` — Returns unconsumed events for the authenticated user, marks them consumed
- Authenticated via JWT (same as existing routes)

#### [NEW] [routes/workflow.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/src/routes/workflow.ts)

New REST endpoints replacing the Socket.IO event handlers from [index.ts](file:///c:/Users/DELL/Downloads/Yo%21/Extenda/extenda/apps/api/src/index.ts):
- `POST /api/workflow/start` — Replaces `socket.on('workflow:start')`
- `POST /api/workflow/resume` — Replaces `socket.on('workflow:resume')`
- `POST /api/workflow/tool-result` — Replaces `socket.on('tool:result')` for client tool responses

These endpoints contain the same business logic currently in [index.ts](file:///c:/Users/DELL/Downloads/Yo%21/Extenda/extenda/apps/api/src/index.ts) lines 121-356, adapted to use the event queue instead of `socket.emit`.

#### [MODIFY] [services/orchestrator.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/src/services/orchestrator.ts)

Replace all `this.io?.emit(...)` and `this.io?.to(...)emit(...)` calls with an event emitter function that writes to the `events` table:

```typescript
// Before:
this.io?.emit(EVENTS_SERVER.WORKFLOW_PLAN, { ... });

// After:
await this.pushEvent(userId, sessionId, EVENTS_SERVER.WORKFLOW_PLAN, { ... });
```

The `pushEvent` method inserts into the `events` table. The [executeClientTool](file:///c:/Users/DELL/Downloads/Yo%21/Extenda/extenda/apps/api/src/services/orchestrator.ts#807-881) method changes from a Socket.IO round-trip to a polling-based approach:
1. Insert a `tool:execute` event into the DB
2. Poll the DB for the corresponding `tool:result` (or use a timeout loop)

---

### Extension: Replace Socket.IO Client with HTTP Polling

#### [MODIFY] [websocket.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/extension/src/lib/websocket.ts)

Replace `socket.io-client` with an HTTP polling client:
- [connect(token)](file:///c:/Users/DELL/Downloads/Yo%21/Extenda/extenda/apps/extension/src/lib/websocket.ts#8-45) → Starts a `setInterval` that polls `GET /api/events`
- [emit(event, data)](file:///c:/Users/DELL/Downloads/Yo%21/Extenda/extenda/apps/extension/src/lib/websocket-background.ts#81-88) → Sends `POST /api/workflow/start` (or appropriate endpoint)
- [on(event, callback)](file:///c:/Users/DELL/Downloads/Yo%21/Extenda/extenda/apps/extension/src/lib/websocket-background.ts#60-72) → Registers callbacks triggered when polling returns matching events
- Keep the same public API (`wsClient.connect()`, `.emit()`, `.on()`, `.off()`) so all consumer code (App.tsx, useVoiceMode.ts) needs **zero changes**

#### [MODIFY] [websocket-background.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/extension/src/lib/websocket-background.ts)

Same approach as above — replace Socket.IO with HTTP polling, maintain the same API surface.

---

### Vercel Build Configuration

#### [MODIFY] [server.ts](file:///c:/Users/DELL/Downloads/Yo!/Extenda/extenda/apps/api/src/server.ts)

Mount the new routes:
```typescript
import events from './routes/events.js';
import workflow from './routes/workflow.js';

app.route('/api/events', events);
app.route('/api/workflow', workflow);
```

---

## Verification Plan

### Automated Tests

1. **Existing test** — Run the existing workflow dependency test to ensure no regressions:
   ```bash
   cd apps/api
   npx tsx src/lib/__tests__/workflow-dependencies.test.ts
   ```

2. **Health check** — After deploying to Vercel, verify the API is reachable:
   ```bash
   curl https://YOUR-VERCEL-URL.vercel.app/health
   # Expected: {"status":"ok"}
   ```

3. **Event polling** — After deploy, test the events endpoint:
   ```bash
   curl -H "Authorization: Bearer <token>" https://YOUR-VERCEL-URL.vercel.app/api/events
   # Expected: [] (empty array, no events yet)
   ```

### Manual Verification

1. **Deploy to Vercel**: Run `vercel` CLI from the monorepo root and verify successful deployment
2. **Update extension URL**: Change the API URL in the extension's websocket client to point to the Vercel deployment
3. **Build + load extension**: `pnpm run build --filter extension`, then load unpacked in Chrome
4. **Test login flow**: Open the extension side panel and verify you can log in / sign up
5. **Test basic chat**: Send a greeting message ("Hello") and verify you get a response
6. **Test workflow**: Send a workflow request (e.g., "List my recent emails") and verify the workflow plan appears and executes

> [!NOTE]
> Steps 4-6 require a working Neon/Postgres database with your schema migrated. We'll run migrations as part of the deployment process.
