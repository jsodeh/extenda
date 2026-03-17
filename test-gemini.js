import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error('Missing GEMINI_API_KEY in environment');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(API_KEY);

async function testModels() {
    console.log('Testing gemini-2.0-flash-exp...');
    try {
        const model1 = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        const result1 = await model1.generateContent('Say hello');
        const response1 = await result1.response;
        console.log('✅ gemini-2.0-flash-exp works:', response1.text().substring(0, 50));
    } catch (e) {
        console.error('❌ gemini-2.0-flash-exp failed:', e.message);
    }

    console.log('\nTesting gemini-2.5-pro...');
    try {
        const model2 = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
        const result2 = await model2.generateContent('Say hello');
        const response2 = await result2.response;
        console.log('✅ gemini-2.5-pro works:', response2.text().substring(0, 50));
    } catch (e) {
        console.error('❌ gemini-2.5-pro failed:', e.message);
    }
}

testModels();
