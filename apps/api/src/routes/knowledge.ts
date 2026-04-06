import { Hono } from 'hono';
import { knowledgeBase } from '../services/knowledge-base.js';
import { processFiles, getFileContents, MulterFile } from '../services/file-processor.js';
import { authMiddleware, AuthEnv } from '../lib/auth.js';

const knowledge = new Hono<AuthEnv>();

// Apply auth middleware to all routes in this router
knowledge.use('*', authMiddleware);

knowledge.post('/upload', async (c) => {
    const user = c.get('user');
    try {
        const body = await c.req.parseBody();
        const file = body['file'] as any; // Hono's parseBody returns File or string

        if (!file || typeof file === 'string') {
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
