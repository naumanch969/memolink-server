import { GenerateContentResponse, GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { ZodSchema } from 'zod';
import { logger } from '../../../config/logger';
import { llmUsageService } from '../../../features/llm-usage/llm-usage.service';
import { withRetry } from '../../utils/retry.util';
import { ILLMProvider, LLMGenerativeOptions } from '../llm.types';

// ONLY GEMINI 2.5 IS SUPPOSED TO BE USED.
const DEFAULT_MODEL = 'gemini-2.5-flash';
const EMBEDDING_MODEL = 'text-embedding-004';


export class GeminiProvider implements ILLMProvider {
    public name = DEFAULT_MODEL;
    private client: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not defined');
        }
        this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.client.getGenerativeModel({ model: DEFAULT_MODEL });
    }

    /**
     * Extracts usageMetadata from a Gemini response and logs it via the usage service.
     * Fire-and-forget: never blocks or throws.
     */
    private logUsage(
        response: GenerateContentResponse,
        model: string,
        startTime: number,
        options?: LLMGenerativeOptions
    ): void {
        const usage = response.usageMetadata;
        if (!usage) return;

        llmUsageService.log({
            userId: options?.userId ?? 'system',
            workflow: options?.workflow ?? 'unknown',
            modelName: model,
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
            durationMs: Date.now() - startTime,
        });
    }

    async generateText(prompt: string, options?: LLMGenerativeOptions): Promise<string> {
        try {
            // Configure model if options provided
            const modelToUse = options?.systemInstruction
                ? this.client.getGenerativeModel({ model: DEFAULT_MODEL, systemInstruction: options.systemInstruction })
                : this.model;

            const generationConfig = {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxOutputTokens,
                responseMimeType: options?.jsonMode ? 'application/json' : 'text/plain',
            };

            const startTime = Date.now();
            const response = await withRetry(
                async () => {
                    const result = await modelToUse.generateContent({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig,
                    });
                    return result.response;
                },
                { operationName: 'Gemini.generateText' }
            );

            this.logUsage(response, DEFAULT_MODEL, startTime, options);
            return response.text();
        } catch (error) {
            // Error is already logged by withRetry if it exhausts attempts, 
            // but we keep this for immediate visibility and backward compatibility
            logger.error('Gemini generateText error:', error);
            throw error;
        }
    }

    async generateJSON<T>(prompt: string, schema: ZodSchema<T>, options?: LLMGenerativeOptions): Promise<T> {
        return withRetry(
            async () => {
                try {
                    // Force JSON mode
                    const textResponse = await this.generateText(prompt, {
                        ...options,
                        jsonMode: true,
                        systemInstruction: options?.systemInstruction
                            ? `${options.systemInstruction}\n\nIMPORTANT: Output strictly valid JSON matching the schema.`
                            : 'You are a helpful assistant. Output strictly valid JSON matching the schema.',
                    });

                    // Clean leading/trailing markdown and whitespace
                    let cleanJson = textResponse.trim();

                    // If it's wrapped in markdown code blocks, extract it
                    const jsonMatch = cleanJson.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                    if (jsonMatch) {
                        cleanJson = jsonMatch[0];
                    }

                    logger.debug('Gemini Raw JSON:', { cleanJson });

                    // Parse and validate
                    let json = JSON.parse(cleanJson);

                    // Robustness: Handle schema mismatch between Array and Object
                    if (Array.isArray(json)) {
                        // If the schema is an object but we got an array, try to grab the first item
                        // This is a common quirk where LLM returns a list of results
                        if (typeof json[0] === 'object' && json[0] !== null) {
                            json = json[0];
                        }
                    } else if (typeof json === 'object' && json !== null) {
                        // Scenario 3: LLM wrapped the result in a key like "result" or "analysis"
                        const keys = Object.keys(json);
                        if (keys.length === 1 && typeof json[keys[0]] === 'object' && json[keys[0]] !== null) {
                            const inner = json[keys[0]];
                            // Only unwrap if the inner object seems to match more than just being an object
                            if (!Array.isArray(inner) || keys[0] !== 'topTags') { // specifically ignore topTags array wrapping if it's the only key
                                json = inner;
                            }
                        }
                    }

                    return schema.parse(json);
                } catch (error: any) {
                    // If it's a SyntaxError (JSON.parse) or ZodError (schema.parse), 
                    // we treat it as a retryable "hallucination" error for this operation.
                    const isValidationError = error instanceof SyntaxError || error.name === 'ZodError';
                    if (isValidationError) {
                        logger.warn('Gemini JSON validation failed, will retry...', { error: error.message });
                        // We throw a custom property to help withRetry identify it
                        (error as any).isTransientValidation = true;
                    }
                    throw error;
                }
            },
            {
                maxAttempts: 2, // Fewer attempts for logic errors to save latency
                shouldRetry: (err) => err.status === 429 || err.status >= 500 || err?.isTransientValidation,
                operationName: 'Gemini.generateJSON'
            }
        );
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

            const startTime = Date.now();
            const response = await withRetry(
                async () => {
                    const result = await modelToUse.generateContent({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig,
                    });
                    return result.response;
                },
                { operationName: 'Gemini.generateWithTools' }
            );

            this.logUsage(response, DEFAULT_MODEL, startTime, options);

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

    async generateEmbeddings(text: string, options?: LLMGenerativeOptions): Promise<number[]> {
        try {
            const startTime = Date.now();
            const result = await withRetry(
                async () => {
                    const embeddingModel = this.client.getGenerativeModel({ model: EMBEDDING_MODEL });
                    return await embeddingModel.embedContent(text);
                },
                { operationName: 'Gemini.generateEmbeddings' }
            );

            // embedContent doesn't return usageMetadata, so estimate token count
            const estimatedTokens = Math.ceil(text.length / 4);
            llmUsageService.log({
                userId: options?.userId ?? 'system',
                workflow: options?.workflow ?? 'embedding',
                modelName: EMBEDDING_MODEL,
                promptTokens: estimatedTokens,
                completionTokens: 0,
                totalTokens: estimatedTokens,
                durationMs: Date.now() - startTime,
            });

            return result.embedding.values;
        } catch (error) {
            logger.error('Gemini generateEmbeddings error:', error);
            throw error;
        }
    }
}
