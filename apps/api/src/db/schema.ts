import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const pgVector = customType<{ data: number[]; config: { dimensions: number } }>({
    dataType(config) {
        return `vector(${config?.dimensions})`;
    },
    toDriver(value: number[]) {
        return JSON.stringify(value);
    },
    fromDriver(value: unknown) {
        return value as number[];
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
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    content: text('content').notNull(),
    embedding: pgVector('embedding', { dimensions: 768 }),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
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
