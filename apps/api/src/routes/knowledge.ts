import { Hono } from 'hono';
import { knowledgeBase } from '../services/knowledge-base.js';
import { processFiles, getFileContents, MulterFile } from '../services/file-processor.js';
import { users } from '../db/schema.js';
import { db } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { AuthService } from '../services/auth-service.js';
import { User } from '@extenda/shared';

type Variables = {
    user: User;
}

const knowledge = new Hono<{ Variables: Variables }>();

// Middleware to verify token for HTTP requests (simplified from socket)
knowledge.use('*', async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'No token provided' }, 401);

    const token = authHeader.split(' ')[1];
    try {
        const { userId } = AuthService.verifyToken(token);
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId as any)
        });

        if (!user) return c.json({ error: 'User not found' }, 401);

        c.set('user', user as any); // Cast as DB user might differ slightly from Shared User or just to be safe
        await next();
    } catch (err) {
        return c.json({ error: 'Invalid token' }, 401);
    }
});

knowledge.post('/upload', async (c) => {
    const user = c.get('user');
    try {
        const body = await c.req.parseBody();
        const file = body['file'] as File;

        if (!file) {
            return c.json({ error: 'No file uploaded' }, 400);
        }

        const content = await file.text();

        // Ingest: Chunk -> Embed -> Store
        await knowledgeBase.ingest(user.id, file.name, content);

        return c.json({ success: true, message: `File ${file.name} processed` });
    } catch (error) {
        console.error('Upload error:', error);
        return c.json({ error: 'Failed to process file' }, 500);
    }
});

/**
 * Process multiple files and extract their content using AI
 * Used for chat attachments - extracts text/descriptions for workflow context
 */
knowledge.post('/process-files', async (c) => {
    try {
        const body = await c.req.parseBody({ all: true });
        const files = body['files'];

        if (!files) {
            return c.json({ error: 'No files uploaded' }, 400);
        }

        // Convert to array if single file
        const fileArray = Array.isArray(files) ? files : [files];

        if (fileArray.length === 0) {
            return c.json({ error: 'No files uploaded' }, 400);
        }

        // Convert Hono File objects to multer-like format
        const multerFiles: MulterFile[] = await Promise.all(
            fileArray.map(async (file: any) => {
                const arrayBuffer = await file.arrayBuffer();
                return {
                    fieldname: 'files',
                    originalname: file.name,
                    encoding: '7bit',
                    mimetype: file.type,
                    buffer: Buffer.from(arrayBuffer),
                    size: file.size
                } as MulterFile;
            })
        );

        // Process with AI
        const processed = await processFiles(multerFiles);
        const contents = getFileContents(processed);

        return c.json({
            success: true,
            processed: processed.length,
            contents
        });
    } catch (error) {
        console.error('File processing error:', error);
        return c.json({ error: 'Failed to process files' }, 500);
    }
});

export default knowledge;

