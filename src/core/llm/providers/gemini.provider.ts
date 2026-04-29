import { GenerateContentResponse, GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { ZodSchema } from 'zod';
import { logger } from '../../../config/logger';
import { AGENT_CONSTANTS } from '../../../features/agent/agent.constants';
import { llmUsageService } from '../../../features/llm-usage/llm-usage.service';
import { withRetry } from '../../utils/retry.utils';
import { ILLMProvider, LLMGenerativeOptions } from '../llm.types';
import { config } from '../../../config/env';

export class GeminiProvider implements ILLMProvider {
    public name = 'Gemini';
    private client: GoogleGenerativeAI;

    constructor() {
        if (!config.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not defined');
        }
        this.client = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    }


    // Extracts usageMetadata from a Gemini response and logs it via the usage service. | Fire-and-forget: never blocks or throws.
    private logUsage(response: GenerateContentResponse, model: string, startTime: number, options?: LLMGenerativeOptions): void {
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

    /**
     * Internal helper to execute a Gemini operation with automatic model fallback on 429 errors.
     * Iterates through TEXT_MODEL_FALLBACKS if a quota limit is hit.
     */
    private async callWithFallback<T>(
        operation: (model: GenerativeModel, modelName: string) => Promise<T>,
        options?: LLMGenerativeOptions
    ): Promise<T> {
        let lastError: any;
        
        for (const modelName of AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS) {
            try {
                const model = this.client.getGenerativeModel({ 
                    model: modelName,
                    systemInstruction: options?.systemInstruction 
                });

                return await operation(model, modelName);
            } catch (error: any) {
                lastError = error;
                const status = error.status || error.response?.status || error.statusCode;
                
                // If 429 (Too Many Requests / Quota Exceeded), attempt fallback to next model
                if (status === 429) {
                    logger.warn(`Gemini Model [${modelName}] quota exceeded (429). Attempting fallback to next priority model...`);
                    continue;
                }

                // For other errors (500s, validation, etc.), let the caller's withRetry handle it
                throw error;
            }
        }

        // If we exhausted all models, throw the last 429 error
        throw lastError;
    }

    async generateText(prompt: string, options?: LLMGenerativeOptions): Promise<string> {
        if (options?.signal?.aborted) throw new Error('Gemini.generateText aborted');

        return this.callWithFallback(async (modelToUse, modelName) => {
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
                {
                    operationName: `Gemini.generateText[${modelName}]`,
                    maxAttempts: 3, // Reduced per-model attempts since we have fallbacks
                    initialDelay: 2000,
                    maxDelay: 30000,
                    shouldRetry: (err) => {
                        const status = err.status || err.response?.status || err.statusCode;
                        return status !== 429 && (status >= 500 || err?.isTransientValidation);
                    },
                    signal: options?.signal
                }
            );

            this.logUsage(response, modelName, startTime, options);
            return response.text();
        }, options);
    }

    async generateJSON<T>(prompt: string, schema: ZodSchema<T>, options?: LLMGenerativeOptions): Promise<T> {
        if (options?.signal?.aborted) throw new Error('Gemini.generateJSON aborted');

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
                        logger.warn('Gemini JSON validation failed, will retry...', { 
                            error: error.message,
                            zodIssues: error.issues,
                            // rawJson: cleanJson.substring(0, 500) + (cleanJson.length > 500 ? '...' : '')
                        });
                        // We throw a custom property to help withRetry identify it
                        (error as any).isTransientValidation = true;
                    }
                    throw error;
                }
            },
            {
                maxAttempts: 6, // Increased attempts for heavy load
                initialDelay: 3000,
                maxDelay: 60000,
                shouldRetry: (err) => {
                    const status = err.status || err.response?.status || err.statusCode;
                    return status !== 429 && (status >= 500 || err?.isTransientValidation);
                },
                operationName: 'Gemini.generateJSON',
                signal: options?.signal
            }
        );
    }

    async generateWithTools(prompt: string, options?: LLMGenerativeOptions): Promise<any> {
        if (options?.signal?.aborted) throw new Error('Gemini.generateWithTools aborted');

        return this.callWithFallback(async (modelToUse, modelName) => {
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
                        tools: options?.tools ? [{ functionDeclarations: options.tools }] : undefined,
                    });
                    return result.response;
                },
                { 
                    operationName: `Gemini.generateWithTools[${modelName}]`,
                    maxAttempts: 3,
                    shouldRetry: (err) => {
                        const status = err.status || err.response?.status || err.statusCode;
                        return status !== 429 && status >= 500;
                    },
                    signal: options?.signal
                }
            );

            this.logUsage(response, modelName, startTime, options);

            // Check for function calls
            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                return {
                    text: response.text(),
                    functionCalls: functionCalls
                };
            }

            return { text: response.text() };
        }, options);
    }

    async generateStream(prompt: string, options?: LLMGenerativeOptions): Promise<AsyncIterable<string>> {
        return this.callWithFallback(async (modelToUse) => {
            const generationConfig = {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxOutputTokens,
            };

            const result = await modelToUse.generateContentStream({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig,
            });

            // Return an async iterable that yields text chunks
            return (async function* () {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        yield chunkText;
                    }
                }
            })();
        }, options);
    }

    async generateEmbeddings(text: string, options?: LLMGenerativeOptions): Promise<number[]> {
        try {
            const startTime = Date.now();

            const result = await withRetry(
                async () => {
                    // Reuse or get the embedding model
                    const embeddingModel = this.client.getGenerativeModel({
                        model: AGENT_CONSTANTS.DEFAULT_EMBEDDING_MODEL, // "text-embedding-004"
                    });

                    // Simple text-based embedding request
                    return await embeddingModel.embedContent(text);
                },
                { operationName: 'Gemini.generateEmbeddings' }
            );

            // Log usage (estimate tokens)
            const estimatedTokens = Math.ceil(text.length / 4);
            llmUsageService.log({
                userId: options?.userId ?? 'system',
                workflow: options?.workflow ?? 'embedding',
                modelName: AGENT_CONSTANTS.DEFAULT_EMBEDDING_MODEL,
                promptTokens: estimatedTokens,
                completionTokens: 0,
                totalTokens: estimatedTokens,
                durationMs: Date.now() - startTime,
            });

            // ✅ Access the embedding correctly
            const embedding = result.embedding.values;
            return embedding;
        } catch (error) {
            logger.error('Gemini generateEmbeddings error:', error);
            throw error;
        }
    }
}
