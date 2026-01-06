import { db } from '../db/index.js';
import { userPreferences } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface UserPreferences {
    userId: string;
    dataSources?: Record<string, any>;
    enabledTools?: string[];
    aiSettings?: Record<string, any>;
    customPrompt?: string | null;
    promptStyle?: string;
}

export class PreferencesService {
    private static cache = new Map<string, { data: UserPreferences, expires: number }>();
    private static TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get user preferences
     */
    static async get(userId: string): Promise<UserPreferences | null> {
        // Check cache
        const cached = this.cache.get(userId);
        if (cached && Date.now() < cached.expires) {
            return cached.data;
        }

        const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId as any)).limit(1);

        if (result.length === 0) {
            return null;
        }

        const row = result[0];
        const prefs = {
            userId: row.userId as string,
            dataSources: row.dataSources as any,
            enabledTools: row.enabledTools as any,
            aiSettings: row.aiSettings as any,
            customPrompt: row.customPrompt,
            promptStyle: row.promptStyle || 'professional'
        };

        // Cache result
        this.cache.set(userId, { data: prefs, expires: Date.now() + this.TTL });

        return prefs;
    }

    /**
     * Clear cache for a user
     */
    static clearCache(userId: string) {
        this.cache.delete(userId);
    }

    /**
     * Create or update user preferences
     */
    static async upsert(preferences: UserPreferences): Promise<void> {
        await db.insert(userPreferences).values({
            userId: preferences.userId as any,
            dataSources: preferences.dataSources,
            enabledTools: preferences.enabledTools,
            aiSettings: preferences.aiSettings,
            customPrompt: preferences.customPrompt,
            promptStyle: preferences.promptStyle || 'professional',
            updatedAt: new Date()
        }).onConflictDoUpdate({
            target: userPreferences.userId,
            set: {
                dataSources: preferences.dataSources,
                enabledTools: preferences.enabledTools,
                aiSettings: preferences.aiSettings,
                customPrompt: preferences.customPrompt,
                promptStyle: preferences.promptStyle || 'professional',
                updatedAt: new Date()
            }
        });

        this.clearCache(preferences.userId);
    }

    /**
     * Delete user preferences
     */
    static async delete(userId: string): Promise<void> {
        await db.delete(userPreferences).where(eq(userPreferences.userId, userId as any));
    }
}
