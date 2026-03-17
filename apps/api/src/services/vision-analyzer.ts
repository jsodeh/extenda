/**
 * Vision Analyzer - Use Gemini Vision to identify UI elements
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ElementLocation {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    description: string;
}

/**
 * Identify an element in a screenshot using Gemini Vision
 */
export async function identifyElement(
    screenshotBase64: string,
    elementDescription: string
): Promise<ElementLocation | null> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `You are analyzing a browser screenshot to find a UI element.

User wants to interact with: "${elementDescription}"

Your task:
1. Locate the element that best matches this description
2. Return the center coordinates (x, y) of that element
3. Estimate the element's bounding box (width, height)
4. Rate your confidence from 0 to 1

The screenshot dimensions are typically around 1280x800 pixels.

Respond ONLY with valid JSON in this exact format:
{
    "found": true,
    "x": <center x coordinate>,
    "y": <center y coordinate>,
    "width": <element width>,
    "height": <element height>,
    "confidence": <0.0 to 1.0>,
    "description": "<what you found>"
}

If the element cannot be found, respond with:
{
    "found": false,
    "reason": "<why element wasn't found>"
}`;

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: screenshotBase64
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[VisionAnalyzer] No JSON in response:', text);
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        if (!parsed.found) {
            console.log('[VisionAnalyzer] Element not found:', parsed.reason);
            return null;
        }

        return {
            x: parsed.x,
            y: parsed.y,
            width: parsed.width,
            height: parsed.height,
            confidence: parsed.confidence,
            description: parsed.description
        };

    } catch (error) {
        console.error('[VisionAnalyzer] Error:', error);
        return null;
    }
}

/**
 * Analyze page layout for multiple interactive elements
 */
export async function analyzePageElements(
    screenshotBase64: string
): Promise<ElementLocation[]> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Analyze this browser screenshot and identify all interactive elements (buttons, links, inputs, etc.).

Return a JSON array of elements:
[
    {
        "x": <center x>,
        "y": <center y>,
        "width": <width>,
        "height": <height>,
        "confidence": <0.0 to 1.0>,
        "description": "<element description>"
    }
]

Focus on the most prominent interactive elements. Limit to 10 elements maximum.`;

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: screenshotBase64
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return [];
        }

        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        console.error('[VisionAnalyzer] Error analyzing page:', error);
        return [];
    }
}
