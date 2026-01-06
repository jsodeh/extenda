import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env');

console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('Error: GEMINI_API_KEY not found in environment variables.');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function testConnection() {
    try {
        console.log('Testing gemini-2.5-flash...');
        const prompt = 'Hello';
        const result = await model.generateContent(prompt);
        console.log('Response:', (await result.response).text());
        console.log('SUCCESS');
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

testConnection();
