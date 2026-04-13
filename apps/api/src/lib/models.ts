import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface ModelConfig {
    provider: string; // 'google', 'openai', 'anthropic', 'ollama'
    model: string;
    apiKey: string;
    baseURL?: string; // For Ollama or proxies
    mode?: string; // 'Fast', 'Planning'
}

export const generateText = async (prompt: string, config?: ModelConfig): Promise<string> => {
    if (!config || (config.provider !== 'ollama' && !config.apiKey)) {
        throw new Error('API Key Missing from Client: Please configure your AI Provider credentials in Extenda Settings.');
    }
    
    if (!config.provider) {
        config.provider = 'google';
    }

    try {
        console.log(`[AI Router] Sending request to ${config.provider} (${config.model || 'default'}). Mode: ${config.mode}`);

        // Add timeout to prevent hanging (60s for complex planning)
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${config.provider} API timeout`)), 60000)
        );

        let resultText = '';

        if (config.provider === 'google') {
            const genAI = new GoogleGenerativeAI(config.apiKey);
            const model = genAI.getGenerativeModel({
                model: config.model || 'gemini-2.0-flash',
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ],
            });

            const result: any = await Promise.race([
                model.generateContent(prompt),
                timeoutPromise
            ]);
            
            resultText = await result.response.text();

        } else if (config.provider === 'openai') {
            const openai = new OpenAI({ apiKey: config.apiKey });
            const result: any = await Promise.race([
                openai.chat.completions.create({
                    model: config.model || 'gpt-4o',
                    messages: [{ role: 'user', content: prompt }]
                }),
                timeoutPromise
            ]);
            
            resultText = result.choices[0].message.content || '';

        } else if (config.provider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey: config.apiKey });
            const result: any = await Promise.race([
                anthropic.messages.create({
                    model: config.model || 'claude-3-5-sonnet-latest',
                    max_tokens: 4096,
                    messages: [{ role: 'user', content: prompt }]
                }),
                timeoutPromise
            ]);
            
            resultText = result.content[0].type === 'text' ? result.content[0].text : '';

        } else if (config.provider === 'ollama') {
            let baseUrl = config.baseURL || 'http://localhost:11434';
            
            // If running inside Docker and URL is localhost, rewrite to host.docker.internal
            // We do this by default in Docker since localhost inside a container is not the host machine
            if (baseUrl.includes('localhost') && !process.env.RENDER) {
                baseUrl = baseUrl.replace('localhost', 'host.docker.internal');
                console.log(`[AI Router] Rewriting Ollama URL for Docker compatibility: ${baseUrl}`);
            }
            
            const result: any = await Promise.race([
                fetch(`${baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: config.model || 'llama3',
                        messages: [{ role: 'user', content: prompt }],
                        stream: false
                    })
                }).then(async res => {
                    if (!res.ok) {
                        const error = await res.text();
                        throw new Error(`Ollama error: ${error}`);
                    }
                    return res.json();
                }),
                timeoutPromise
            ]).catch(err => {
                // Diagnose connectivity failure
                if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
                    if (process.env.RENDER) {
                        throw new Error('Ollama Connectivity: A cloud-hosted backend cannot reach your local host. Please use the Local (3000) backend in Extenda settings or use a tunnel (e.g., ngrok).');
                    }
                    throw new Error(`Local Ollama Unreachable at ${baseUrl}. Ensure Ollama is running and OLLAMA_HOST=0.0.0.0 is set.`);
                }
                throw err;
            });
            
            resultText = result.message?.content || '';

        } else {
            throw new Error(`Unsupported AI Provider: ${config.provider}`);
        }

        if (!resultText || resultText.trim().length === 0) {
            console.error(`[AI Router] Empty response received. Provider: ${config.provider}`);
            throw new Error(`${config.provider} returned an empty response`);
        }

        return resultText;
    } catch (error: any) {
        console.error(`[AI Router] API Error (${config.provider}):`, error.message || error);
        
        if (error.message?.includes('model output must contain') || error.message?.includes('safety')) {
            console.error('[AI Router] Safety filters may have blocked the response');
            return "I'm ready to help! What would you like me to do?";
        }
        
        throw error;
    }
};

export const embedContent = async (text: string, config?: ModelConfig): Promise<number[]> => {
    if (!config || (config.provider !== 'ollama' && !config.apiKey)) {
        throw new Error('API Key Missing: Cannot generate embeddings without credentials.');
    }

    if (config.provider === 'google' || !config.provider) {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    } else if (config.provider === 'openai') {
        const openai = new OpenAI({ apiKey: config.apiKey });
        const result = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
        });
        return result.data[0].embedding;
    } else if (config.provider === 'ollama') {
        const baseUrl = config.baseURL || 'http://localhost:11434';
        const response = await fetch(`${baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model || 'llama3',
                prompt: text
            })
        });
        const result: any = await response.json();
        return result.embedding;
    } else {
        // Anthropic doesn't have a direct embedding API as commonly used, 
        // Fallback to OpenAI or Google if the user forces it, or we throw:
        throw new Error(`Embedding not supported natively for chosen provider: ${config.provider}`);
    }
};
