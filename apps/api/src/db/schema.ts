import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, serial, customType, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const pgVector = customType<{ data: number[]; config: { dimensions: number } }>({
    dataType(config) {
        return `vector(${config?.dimensions})`;
    },
    toDriver(value: number[]) {
        return JSON.stringify(value);
    },
    fromDriver(value: unknown) {
        return typeof value==='string' ? JSON.parse(value) : value as number[];
    },
});


export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
    role: text('role').default('free'),
    googleAccessToken: text('google_access_token'),
    googleRefreshToken: text('google_refresh_token'),
    settings: jsonb('settings').default({}),
    emailVerified: boolean('email_verified').default(false),
    onboardingCompleted: boolean('onboarding_completed').default(false),
    lastLogin: timestamp('last_login'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const modelConfigs = pgTable('model_configs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    apiKeyEncrypted: text('api_key_encrypted'),
    endpoint: text('endpoint'),
    priority: integer('priority').default(1),
    settings: jsonb('settings').default({}),
    createdAt: timestamp('created_at').defaultNow(),
});

export const workflows = pgTable('workflows', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    icon: text('icon'),
    intent: text('intent').notNull(),
    definition: jsonb('definition').notNull(),
    parameters: jsonb('parameters').default([]),
    isTemplate: boolean('is_template').default(false),
    isPublic: boolean('is_public').default(false),
    version: integer('version').default(1),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const executions = pgTable('executions', {
    id: uuid('id').defaultRandom().primaryKey(),
    workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull(), // pending, running, paused, completed, failed
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    context: jsonb('context').notNull(),
    result: jsonb('result'),
    error: jsonb('error'),
});

export const stepExecutions = pgTable('step_executions', {
    id: uuid('id').defaultRandom().primaryKey(),
    executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }),
    stepId: text('step_id').notNull(),
    status: text('status').notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    result: jsonb('result'),
    error: jsonb('error'),
    retryCount: integer('retry_count').default(0),
});

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    executionId: uuid('execution_id').references(() => executions.id),
    action: text('action').notNull(),
    details: jsonb('details'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const documents = pgTable('documents', {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name',{length:255}).notNull(),
    filePath: text('file_path'),
    legacyId: uuid('legacy_id').unique(),
    size: integer('file_size').notNull(),
    fileType: text('file_type').notNull(),
    original: customType<{data: Buffer}>({ dataType: () => 'bytea' })('original'),
    checksum: text('checksum'),
    status: text('status').default('processing'),
    chunksCount: integer('chunks_count').default(0),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const documentChunks = pgTable('document_chunks', {
    id: serial('id').primaryKey(),
    documentId: integer('document_id').references(() => documents.id, {onDelete: 'cascade'}).notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: pgVector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').defaultNow(),
    embeddingModel: text('embedding_model'),
    metadata: jsonb('metadata').default({}),
});

export const chatSessions = pgTable('chat_sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New Chat'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user', 'assistant', 'system'
    content: text('content').notNull(),
    metadata: jsonb('metadata'), // Can store workflow IDs, step IDs, etc.
    createdAt: timestamp('created_at').defaultNow(),
});

export const userPreferences = pgTable('user_preferences', {
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
    dataSources: jsonb('data_sources').default({}),
    enabledTools: jsonb('enabled_tools').default([]),
    toolPermissions: jsonb('tool_permissions').default({}),
    aiSettings: jsonb('ai_settings').default({}),
    customPrompt: text('custom_prompt'),
    promptStyle: text('prompt_style').default('professional'),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const oauthCredentials = pgTable('oauth_credentials', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    provider: text('provider').notNull(),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    expiresAt: timestamp('expires_at'),
    scope: text('scope'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
    unq: sql`UNIQUE ("user_id", "provider")`,
}));

export const scheduledJobs = pgTable('scheduled_jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id,{onDelete:'cascade'}),
    action: text('action').notNull(),
    dueAt: timestamp('due_at',{withTimezone:true}).notNull(),
    timezone: text('timezone').notNull(),
    recurrence: text('recurrence').notNull().default('once'),
    status: text('status').notNull().default('pending'),
    approvedPayload: jsonb('approved_payload').notNull(),
    approval: text('approval').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    attempts: integer('attempts').notNull().default(0),
    result: jsonb('result'),
    claimedAt: timestamp('claimed_at',{withTimezone:true}),
    createdAt: timestamp('created_at',{withTimezone:true}).defaultNow()
},t=>({byRequest:uniqueIndex('scheduled_jobs_user_id_idempotency_key_key').on(t.userId,t.idempotencyKey)}));

export const personalReminders = pgTable('personal_reminders',{
    jobId: uuid('job_id').references(()=>scheduledJobs.id,{onDelete:'cascade'}).notNull(),
    occurrence: timestamp('occurrence',{withTimezone:true}).notNull(),
    message: text('message').notNull(),
    delivered: boolean('delivered').notNull().default(false)
},t=>({pk:primaryKey({columns:[t.jobId,t.occurrence]})}));

export const linkedinDrafts = pgTable('linkedin_drafts',{
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(()=>users.id,{onDelete:'cascade'}).notNull(),
    content: text('content').notNull(),
    visibility: text('visibility').notNull(),
    link: text('link'),
    version: integer('version').default(1).notNull(),
    jobId: uuid('job_id').references(()=>scheduledJobs.id,{onDelete:'set null'}),
    createdAt: timestamp('created_at',{withTimezone:true}).defaultNow(),
    updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow()
});

export const oauthLinkStates = pgTable('oauth_link_states',{
    nonce: uuid('nonce').primaryKey(),
    userId: uuid('user_id').references(()=>users.id,{onDelete:'cascade'}).notNull(),
    provider: text('provider').notNull(),
    expiresAt: timestamp('expires_at',{withTimezone:true}).default(sql`now()+interval '10 minutes'`).notNull()
});

export const workflowRequests = pgTable('workflow_requests',{
    userId: uuid('user_id').references(()=>users.id,{onDelete:'cascade'}).notNull(),
    requestId: uuid('request_id').notNull(),
    createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>({pk:primaryKey({columns:[t.userId,t.requestId]})}));
