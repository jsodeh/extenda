import { generateText } from '../lib/gemini.js';

interface AIProcessorParams {
    action: 'summarize' | 'analyze' | 'categorize';
    content: string | any;
    context?: string;
}

export class AIProcessor {
    /**
     * Summarize content
     */
    static async summarize(content: string, maxLength: number = 200): Promise<string> {
        const prompt = `Summarize the following content in ${maxLength} words or less. Be concise and capture the key points:\n\n${content}`;
        const summary = await generateText(prompt);
        return summary.trim();
    }

    /**
     * Analyze content and extract insights
     */
    static async analyze(content: string, focusArea?: string): Promise<any> {
        const focusPrompt = focusArea ? `Focus on: ${focusArea}` : '';
        const prompt = `Analyze the following content and provide key insights, patterns, and important information. ${focusPrompt}\n\nContent:\n${content}\n\nReturn insights as a JSON object with: { insights: string[], patterns: string[], keyPoints: string[] }`;

        try {
            const response = await generateText(prompt);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            return {
                insights: [],
                patterns: [],
                keyPoints: ['Error analyzing content']
            };
        }
    }

    /**
     * Categorize content
     */
    static async categorize(content: string, categories?: string[]): Promise<string> {
        const categoryList = categories?.join(', ') || 'urgent, important, informational, action_required, can_wait';
        const prompt = `Categorize the following content into one of these categories: ${categoryList}\n\nContent:\n${content}\n\nReturn ONLY the category name, nothing else.`;

        const category = await generateText(prompt);
        return category.trim().toLowerCase();
    }

    /**
     * Main execute function for tool registry
     */
    static async execute(params: AIProcessorParams): Promise<any> {
        const { action, content, context } = params;

        // Convert content to string if it's an object
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

        switch (action) {
            case 'summarize':
                const summary = await this.summarize(contentStr);
                return { summary, output: summary, payload: summary };

            case 'analyze':
                const analysis = await this.analyze(contentStr, context);
                return { analysis, output: analysis, payload: analysis };

            case 'categorize':
                const category = await this.categorize(contentStr);
                return { category, output: category, payload: category };

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
}

// Tool registration metadata
export const AIProcessorTool = {
    name: 'AIProcessor',
    description: 'AI-powered data processing: summarize content, analyze patterns, categorize items',
    execute: AIProcessor.execute.bind(AIProcessor),
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['summarize', 'analyze', 'categorize'],
                description: 'The AI action to perform'
            },
            content: {
                type: 'string',
                description: 'The content to process'
            },
            context: {
                type: 'string',
                description: 'Optional context for analysis'
            }
        },
        required: ['action', 'content']
    },
    validate: (params: any) => {
        if (!params.action || !params.content) {
            return { valid: false, error: 'Missing required params: action, content' };
        }
        if (!['summarize', 'analyze', 'categorize'].includes(params.action)) {
            return { valid: false, error: 'Invalid action. Must be: summarize, analyze, or categorize' };
        }
        return { valid: true };
    }
};
