/**
 * Vision API Routes - Element identification using Gemini Vision
 */

import { bodyLimit } from 'hono/body-limit';
import { Hono } from 'hono';
import { identifyElement, analyzePageElements } from '../services/vision-analyzer.js';

import { authMiddleware } from '../lib/auth.js';
const vision = new Hono();
vision.use('*',authMiddleware);
vision.use('*',bodyLimit({maxSize: 12*1024*1024}));

/**
 * POST /vision/identify-element
 * Identify a specific element in a screenshot
 */
vision.post('/identify-element', async (c) => {
    try {
        const { screenshot, description } = await c.req.json();

        if (!screenshot || !description) {
            return c.json({
                error: 'screenshot and description are required'
            }, 400);
        }


        const element = await identifyElement(screenshot, description);

        if (!element) {
            return c.json({
                success: false,
                error: `Could not find element matching: "${description}"`
            });
        }

        return c.json({
            success: true,
            element
        });

    } catch (error: any) {
        console.error('[Vision] Error');
        return c.json({
            error: 'Screenshot analysis failed'
        }, 500);
    }
});

/**
 * POST /vision/analyze-page
 * Analyze all interactive elements on a page
 */
vision.post('/analyze-page', async (c) => {
    try {
        const { screenshot } = await c.req.json();

        if (!screenshot) {
            return c.json({
                error: 'screenshot is required'
            }, 400);
        }


        const elements = await analyzePageElements(screenshot);

        return c.json({
            success: true,
            elements
        });

    } catch (error: any) {
        console.error('[Vision] Error');
        return c.json({
            error: 'Screenshot analysis failed'
        }, 500);
    }
});

export { vision };
