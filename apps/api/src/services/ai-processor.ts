/**
 * AIProcessor Tool - AI-powered content processing
 * Runs on backend using Gemini
 */

import { generateText, ModelConfig } from '../lib/models.js';

export interface AIProcessorParams {
    action: 'summarize' | 'categorize' | 'extract' | 'analyze';
    content: string;
    options?: {
        maxLength?: number;
        categories?: string[];
        extractFields?: string[];
    };
}

export interface AIProcessorResult {
    success: boolean;
    result?: any;
    error?: string;
}

export class AIProcessor {
    /**
     * Summarize content
     */
    static async summarize(content: string, maxLength: number = 200, modelConfig?: ModelConfig): Promise<string> {
        const prompt = `Summarize the following content in ${maxLength} characters or less:

${content}

Summary:`;

        const response = await generateText(prompt, modelConfig);
        return response.trim();
    }

    /**
     * Categorize content
     */
    static async categorize(content: string, categories: string[], modelConfig?: ModelConfig): Promise<string> {
        const prompt = `Categorize the following content into one of these categories: ${categories.join(', ')}

Content:
${content}

Category:`;

        const response = await generateText(prompt, modelConfig);
        return response.trim();
    }

    /**
     * Extract specific information
     */
    static async extract(content: string, fields: string[], modelConfig?: ModelConfig): Promise<Record<string, string>> {
        const prompt = `Extract the following information from the content:
${fields.map(f => `- ${f}`).join('\n')}

Content:
${content}

Return the results in JSON format with keys: ${fields.join(', ')}`;

        const response = await generateText(prompt, modelConfig);

        try {
            return JSON.parse(response);
        } catch {
            // If not valid JSON, return as text
            const result: Record<string, string> = {};
            fields.forEach(field => {
                result[field] = response.includes(field) ? response.split(field)[1]?.trim() || '' : '';
            });
            return result;
        }
    }

    /**
     * General analysis
     */
    static async analyze(content: string, modelConfig?: ModelConfig): Promise<string> {
        const prompt = `Analyze the following content and provide insights:

${content}

Analysis:`;

        const response = await generateText(prompt, modelConfig);
        return response.trim();
    }

    /**
     * Execute AIProcessor action
     */
    static async execute(params: AIProcessorParams, executionContext?: any): Promise<AIProcessorResult> {
        try {
            let result: any;
            const modelConfig = executionContext?.modelConfig;

            switch (params.action) {
                case 'summarize':
                    result = await this.summarize(
                        params.content,
                        params.options?.maxLength,
                        modelConfig
                    );
                    break;

                case 'categorize':
                    if (!params.options?.categories) {
                        throw new Error('categories required for categorize action');
                    }
                    result = await this.categorize(
                        params.content,
                        params.options.categories,
                        modelConfig
                    );
                    break;

                case 'extract':
                    if (!params.options?.extractFields) {
                        throw new Error('extractFields required for extract action');
                    }
                    result = await this.extract(
                        params.content,
                        params.options.extractFields,
                        modelConfig
                    );
                    break;

                case 'analyze':
                    result = await this.analyze(params.content, modelConfig);
                    break;

                default:
                    throw new Error(`Unknown action: ${params.action}`);
            }

            return { success: true, result };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
