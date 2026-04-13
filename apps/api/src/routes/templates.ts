import { Hono } from 'hono';
import { db } from '../db/index.js';
import { workflows } from '../db/schema.js';
import { eq, or, and } from 'drizzle-orm';
import { authMiddleware, AuthEnv } from '../lib/auth.js';

const templates = new Hono<AuthEnv>();

// Apply auth middleware to all template routes
templates.use('*', authMiddleware);

/**
 * GET /api/templates
 * Get all workflow templates
 */
templates.get('/', async (c) => {
    const user = c.get('user');
    
    try {
        const result = await db.select()
            .from(workflows)
            .where(
                and(
                    eq(workflows.isTemplate, true),
                    or(
                        eq(workflows.isPublic, true),
                        eq(workflows.userId, user.id as any)
                    )
                )
            )
            .orderBy(workflows.category, workflows.name);

        return c.json({ templates: result });
    } catch (error) {
        console.error('Error fetching templates:', error);
        return c.json({ error: 'Failed to fetch templates' }, 500);
    }
});

/**
 * GET /api/templates/:id
 * Get a specific template
 */
templates.get('/:id', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');

    try {
        const [template] = await db.select()
            .from(workflows)
            .where(
                and(
                    eq(workflows.id, id as any),
                    eq(workflows.isTemplate, true),
                    or(
                        eq(workflows.isPublic, true),
                        eq(workflows.userId, user.id as any)
                    )
                )
            );

        if (!template) {
            return c.json({ error: 'Template not found' }, 404);
        }

        return c.json({ template });
    } catch (error) {
        console.error('Error fetching template:', error);
        return c.json({ error: 'Failed to fetch template' }, 500);
    }
});

/**
 * POST /api/templates/execute
 * Execute a template with parameters
 */
templates.post('/execute', async (c) => {
    const user = c.get('user');
    
    try {
        const body = await c.req.json();
        const { templateId, parameters } = body;

        // Fetch template
        const [template] = await db.select()
            .from(workflows)
            .where(
                and(
                    eq(workflows.id, templateId as any),
                    eq(workflows.isTemplate, true)
                )
            );

        if (!template) {
            return c.json({ error: 'Template not found' }, 404);
        }

        // Replace parameters in template definition
        let workflowJson = JSON.stringify(template.definition);

        if (parameters && typeof parameters === 'object') {
            for (const [key, value] of Object.entries(parameters)) {
                const placeholder = `\${${key}}`;
                // Simple string replacement for basic templates
                workflowJson = workflowJson.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
            }
        }

        const workflow = JSON.parse(workflowJson);

        return c.json({
            workflow,
            name: template.name,
            description: template.description
        });
    } catch (error) {
        console.error('Error executing template:', error);
        return c.json({ error: 'Failed to execute template' }, 500);
    }
});

export default templates;
