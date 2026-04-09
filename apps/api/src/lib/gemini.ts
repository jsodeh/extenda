import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ],
    });
} else {
    console.warn('GEMINI_API_KEY not found in environment variables. AI features will stay in mock mode.');
}

export const generateText = async (prompt: string): Promise<string> => {
    if (!model) {
        console.log('[MOCK AI] Generating response for:', prompt);
        return JSON.stringify({
            steps: [
                { id: '1', type: 'tool', description: 'Mock Step 1 using ' + prompt },
                { id: '2', type: 'tool', description: 'Mock Step 2' }
            ]
        });
    }

    try {
        console.log('[Gemini] Sending request...');

        // Add timeout to prevent hanging (60s for complex planning)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Gemini API timeout')), 60000)
        );

        const result: any = await Promise.race([
            model.generateContent(prompt),
            timeoutPromise
        ]);

        const response = await result.response;
        const text = response.text();

        console.log('[Gemini] Response received, length:', text.length);

        if (!text || text.trim().length === 0) {
            console.error('[Gemini] Empty response received. Prompt preview:', prompt.substring(0, 200));
            throw new Error('Gemini returned empty response');
        }

        return text;
    } catch (error: any) {
        console.error('[Gemini] API Error:', error.message || error);
        if (error.message?.includes('model output must contain')) {
            console.error('[Gemini] Safety filters may have blocked the response');
            // Return a fallback response instead of failing
            return "I'm ready to help! What would you like me to do?";
        }
        throw error;
    }
};
