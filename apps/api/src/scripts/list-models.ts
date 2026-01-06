import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Assuming script is in src/scripts or src/db, pointing to root .env
const envPath = resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('GEMINI_API_KEY not found in .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function main() {
    try {
        console.log('Fetching available models...');
        // Hack: The SDK doesn't expose listModels directly on the main class in some versions, 
        // asking the user to use the REST API manually or use the model manager if exposed.
        // Actually, older/newer SDKs might behave differently. 
        // Let's try a direct fetch if the SDK doesn't make it easy, or just try to generate with a few common ones. 

        // Wait, the error message literally says: "Call ListModels to see the list of available models"
        // The SDK might not expose it easily, checking via fetch is safer.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const models = (data as any).models || [];

        console.log('Available Models:');
        models.forEach((m: any) => {
            if (m.supportedGenerationMethods.includes('generateContent')) {
                console.log(`- ${m.name} (${m.displayName})`);
            }
        });

    } catch (error) {
        console.error('Error fetching models:', error);
    }
}

main();
