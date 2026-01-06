import { Hono } from 'hono';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/extenda',
});

const query = (text: string, params?: any[]) => pool.query(text, params);

const templates = new Hono();

/**
 * GET /api/templates
 * Get all workflow templates
 */
templates.get('/', async (c) => {
    try {
        const result = await query(`
            SELECT id, name, description, category, icon, template, parameters, is_public
            FROM workflow_templates
            WHERE is_public = true OR created_by = $1
            ORDER BY category, name
        `, ['2c7649f8-039e-4d2b-91ca-cb57e888811c']); // TODO: Get userId from auth

        return c.json({ templates: result.rows });
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

    try {
        const result = await query(`
            SELECT * FROM workflow_templates WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return c.json({ error: 'Template not found' }, 404);
        }

        return c.json({ template: result.rows[0] });
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
    try {
        const body = await c.req.json();
        const { templateId, parameters } = body;

        // Fetch template
        const templateResult = await query(`
            SELECT * FROM workflow_templates WHERE id = $1
        `, [templateId]);

        if (templateResult.rows.length === 0) {
            return c.json({ error: 'Template not found' }, 404);
        }

        const template = templateResult.rows[0];

        // Replace parameters in template
        let workflowJson = JSON.stringify(template.template);

        for (const [key, value] of Object.entries(parameters)) {
            const placeholder = `\${${key}}`;
            workflowJson = workflowJson.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
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
