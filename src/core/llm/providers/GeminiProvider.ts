import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { ZodSchema } from 'zod';
import { logger } from '../../../config/logger';
import { LLMGenerativeOptions, LLMProvider } from '../types';

export class GeminiProvider implements LLMProvider {
    public name = 'models/gemini-2.5-flash';
    private client: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not defined');
        }
        this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using gemini-pro as stable fallback for now
        this.model = this.client.getGenerativeModel({ model: 'models/gemini-2.5-flash' });
    }

    async generateText(prompt: string, options?: LLMGenerativeOptions): Promise<string> {
        try {
            // Configure model if options provided
            const modelToUse = options?.systemInstruction
                ? this.client.getGenerativeModel({
                    model: 'models/gemini-2.5-flash',
                    systemInstruction: options.systemInstruction
                })
                : this.model;

            const generationConfig = {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxOutputTokens,
                responseMimeType: options?.jsonMode ? 'application/json' : 'text/plain',
            };

            const result = await modelToUse.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig,
            });

            const response = result.response;
            return response.text();
        } catch (error) {
            logger.error('Gemini generateText error:', error);
            throw error;
        }
    }

    async generateJSON<T>(prompt: string, schema: ZodSchema<T>, options?: LLMGenerativeOptions): Promise<T> {
        try {
            // Force JSON mode
            const textResponse = await this.generateText(prompt, {
                ...options,
                jsonMode: true,
                // Append instruction to ensure JSON match if not already present
                systemInstruction: options?.systemInstruction
                    ? `${options.systemInstruction}\n\nIMPORTANT: Output strictly valid JSON.`
                    : 'You are a helpful assistant. Output strictly valid JSON.',
            });

            // Clean Markdown code blocks (```json ... ```)
            const cleanJson = textResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '');

            // Parse and validate
            const json = JSON.parse(cleanJson);
            return schema.parse(json);
        } catch (error) {
            logger.error('Gemini generateJSON error:', error);
            throw error;
        }
    }
}
