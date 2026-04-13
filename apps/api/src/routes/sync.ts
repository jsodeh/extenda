import { Hono } from 'hono';
import { authMiddleware, AuthEnv } from '../lib/auth.js';
import { chatService } from '../services/chat-service.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const sync = new Hono<AuthEnv>();

sync.use('*', authMiddleware);

/**
 * GET /api/sync/export
 * Returns an encrypted bundle of the user's data
 */
sync.get('/export', async (c) => {
    try {
        const user = c.get('user');
        const data = await chatService.exportData(user.id);
        const encryptedBundle = encrypt(JSON.stringify(data));
        
        return c.json({ 
            bundle: encryptedBundle,
            exportedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Export error:', error);
        return c.json({ error: 'Failed to export data' }, 500);
    }
});

/**
 * POST /api/sync/import
 * Accepts an encrypted bundle and merges it into the current database
 */
sync.post('/import', async (c) => {
    try {
        const user = c.get('user');
        const { bundle } = await c.req.json();
        
        if (!bundle) {
            return c.json({ error: 'No bundle provided' }, 400);
        }

        const decryptedData = JSON.parse(decrypt(bundle));
        const result = await chatService.importData(user.id, decryptedData);
        
        return c.json({ 
            success: true, 
            message: `Successfully imported ${result.count} sessions` 
        });
    } catch (error) {
        console.error('Import error:', error);
        return c.json({ error: 'Failed to import data. Check your secret key.' }, 500);
    }
});

export default sync;
