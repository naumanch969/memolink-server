import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { ZodSchema } from 'zod';
import { logger } from '../../../config/logger';
import { LLMGenerativeOptions, LLMProvider } from '../types';

const DEFAULT_MODEL = 'models/gemini-2.5-flash';

export class GeminiProvider implements LLMProvider {
    public name = DEFAULT_MODEL;
    private client: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not defined');
        }
        this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using gemini-pro as stable fallback for now
        this.model = this.client.getGenerativeModel({ model: DEFAULT_MODEL });
    }

    async generateText(prompt: string, options?: LLMGenerativeOptions): Promise<string> {
        try {
            // Configure model if options provided
            const modelToUse = options?.systemInstruction
                ? this.client.getGenerativeModel({
                    model: DEFAULT_MODEL,
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
            const cleanJson = textResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
            // Sometimes Gemini wraps in [] even for single object requests
            if (cleanJson.startsWith('[') && cleanJson.endsWith(']')) {
                // Determine if we should treat it as an array or just peel it
            }

            logger.debug('Gemini Raw JSON:', { cleanJson });

            // Parse and validate
            let json = JSON.parse(cleanJson);

            // Robustness: If we expect an object but got an array, take the first item
            if (Array.isArray(json)) {
                logger.warn('Gemini returned an array, using first item');
                json = json[0];
            }

            return schema.parse(json);
        } catch (error) {
            logger.error('Gemini generateJSON error:', error);
            throw error;
        }
    }

    async generateWithTools(prompt: string, options?: LLMGenerativeOptions): Promise<any> {
        try {
            // Configure model if options provided
            const modelParams: any = {
                model: DEFAULT_MODEL,
            };

            if (options?.systemInstruction) {
                modelParams.systemInstruction = options.systemInstruction;
            }

            if (options?.tools) {
                // Formatting for Google Gemini API: tools must be an array of Tool objects, each containing functionDeclarations.
                modelParams.tools = [{ functionDeclarations: options.tools }];
            }

            const modelToUse = this.client.getGenerativeModel(modelParams);

            const generationConfig = {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxOutputTokens,
            };

            const result = await modelToUse.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig,
            });

            const response = result.response;

            // Check for function calls
            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                return {
                    text: response.text(), // Might be empty if it's just a function call
                    functionCalls: functionCalls
                };
            }

            return {
                text: response.text()
            };
        } catch (error) {
            logger.error('Gemini generateWithTools error:', error);
            throw error;
        }
    }

    async generateEmbeddings(text: string): Promise<number[]> {
        try {
            const embeddingModel = this.client.getGenerativeModel({ model: 'text-embedding-004' });
            const result = await embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            logger.error('Gemini generateEmbeddings error:', error);
            throw error;
        }
    }
}
