
import { db } from '../db/index.js';
import { chatSessions, chatMessages } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
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
}

export const chatService = new ChatService();
