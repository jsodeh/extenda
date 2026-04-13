
import { db } from '../db/index.js';
import { chatSessions, chatMessages, workflows } from '../db/schema.js';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export class ChatService {
    async createSession(userId: string, title: string = 'New Chat') {
        const [session] = await db.insert(chatSessions).values({
            id: randomUUID(),
            userId: userId as any, // Cast for UUID
            title,
        }).returning();
        return session;
    }

    async getSessions(userId: string) {
        return db.select()
            .from(chatSessions)
            .where(eq(chatSessions.userId, userId as any))
            .orderBy(desc(chatSessions.updatedAt));
    }

    async getSession(sessionId: string) {
        const [session] = await db.select()
            .from(chatSessions)
            .where(eq(chatSessions.id, sessionId as any));
        return session;
    }

    async getMessages(sessionId: string) {
        return db.select()
            .from(chatMessages)
            .where(eq(chatMessages.sessionId, sessionId as any))
            .orderBy(chatMessages.createdAt);
    }

    async addMessage(sessionId: string, role: string, content: string, metadata?: any) {
        const [message] = await db.insert(chatMessages).values({
            id: randomUUID(),
            sessionId: sessionId as any,
            role,
            content,
            metadata,
        }).returning();

        // Update session updatedAt
        await db.update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.id, sessionId as any));

        return message;
    }

    async updateSessionTitle(sessionId: string, title: string) {
        await db.update(chatSessions)
            .set({ title })
            .where(eq(chatSessions.id, sessionId as any));
    }

    async exportData(userId: string) {
        // Fetch everything for this user
        const sessions = await db.select().from(chatSessions).where(eq(chatSessions.userId, userId as any));
        const messages = await db.select().from(chatMessages).where(
            and(
                // @ts-ignore - sessionId in schema is UUID
                inArray(chatMessages.sessionId, sessions.map(s => s.id))
            )
        );
        const userWorkflows = await db.select().from(workflows).where(eq(workflows.userId, userId as any));

        return {
            sessions,
            messages,
            workflows: userWorkflows,
            exportedAt: new Date().toISOString()
        };
    }

    async importData(userId: string, data: any) {
        const { sessions, messages, workflows: importedWorkflows } = data;

        // 1. Import Workflows first (dependencies)
        for (const wf of importedWorkflows) {
            await db.insert(workflows).values({
                ...wf,
                userId: userId as any,
                updatedAt: new Date()
            }).onConflictDoUpdate({
                target: workflows.id,
                set: { ...wf, updatedAt: new Date() }
            });
        }

        // 2. Import Sessions
        for (const session of sessions) {
            await db.insert(chatSessions).values({
                ...session,
                userId: userId as any,
                updatedAt: new Date()
            }).onConflictDoUpdate({
                target: chatSessions.id,
                set: { ...session, updatedAt: new Date() }
            });
        }

        // 3. Import Messages
        for (const msg of messages) {
            await db.insert(chatMessages).values({
                ...msg,
            }).onConflictDoUpdate({
                target: chatMessages.id,
                set: { ...msg }
            });
        }

        return { success: true, count: sessions.length };
    }
}

export const chatService = new ChatService();
