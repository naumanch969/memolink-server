import { GenerateContentResponse, GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { ZodSchema } from 'zod';
import { logger } from '../../../config/logger';
import { AGENT_CONSTANTS } from '../../../features/agent/agent.constants';
import { llmUsageService } from '../../../features/llm-usage/llm-usage.service';
import { withRetry } from '../../utils/retry.utils';
import { ILLMProvider, LLMGenerativeOptions } from '../llm.types';
import { config } from '../../../config/env';
import { redisConnection } from '../../../config/redis';

export class GeminiProvider implements ILLMProvider {
    public name = 'Gemini';
    private clients: GoogleGenerativeAI[] = [];
    private apiKeys: { key: string; isPaid: boolean }[] = [];

    constructor() {
        this.apiKeys = [
            { key: config.GEMINI_API_KEY, isPaid: false },
            { key: config.GEMINI_API_KEY_2, isPaid: false },
            { key: config.GEMINI_API_KEY_3, isPaid: false },
            { key: config.PAID_GEMINI_API_KEY, isPaid: true }
        ].filter(k => !!k.key);

        if (this.apiKeys.length === 0) {
            throw new Error('No Gemini API keys defined in configuration');
        }

        this.clients = this.apiKeys.map(k => new GoogleGenerativeAI(k.key));
    }

    /**
     * Checks if the quota for a specific model and key index is exceeded.
     * Enforces 500 RPD and 15 RPM for Gemini 3.1 models on free keys.
     */
    private async checkQuota(modelName: string, keyIndex: number): Promise<boolean> {
        const keyConfig = this.apiKeys[keyIndex];
        if (!keyConfig) return false;

        // Quota only enforced for 3.1 model free keys as requested
        if (!modelName.includes('3.1') || keyConfig.isPaid) return true;

        try {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const minuteStr = Math.floor(now.getTime() / 60000).toString();

            const rpdKey = `llm:quota:3.1:rpd:${dateStr}`;
            const rpmKey = `llm:quota:3.1:rpm:${keyIndex}:${minuteStr}`;

            // Check RPD (Shared across free keys for the 3.1 model)
            const rpd = await redisConnection.get(rpdKey);
            if (rpd && parseInt(rpd) >= 500) {
                logger.warn(`Gemini 3.1 Global RPD limit (500) reached for Key [${keyIndex}].`);
                return false;
            }

            // Check RPM (Per key limit)
            const rpm = await redisConnection.get(rpmKey);
            if (rpm && parseInt(rpm) >= 15) {
                logger.debug(`Gemini 3.1 Key [${keyIndex}] RPM limit (15) reached.`);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error checking Gemini quota in Redis:', error);
            return true; // Fail open
        }
    }

    /**
     * Increments the usage counters for a model/key in Redis.
     */
    private async incrementQuota(modelName: string, keyIndex: number): Promise<void> {
        const keyConfig = this.apiKeys[keyIndex];
        if (!keyConfig || !modelName.includes('3.1') || keyConfig.isPaid) return;

        try {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const minuteStr = Math.floor(now.getTime() / 60000).toString();

            const rpdKey = `llm:quota:3.1:rpd:${dateStr}`;
            const rpmKey = `llm:quota:3.1:rpm:${keyIndex}:${minuteStr}`;

            const multi = redisConnection.multi();
            multi.incr(rpdKey);
            multi.expire(rpdKey, 86400); // 24h
            multi.incr(rpmKey);
            multi.expire(rpmKey, 60);    // 1m
            await multi.exec();
        } catch (error) {
            logger.error('Error incrementing Gemini quota in Redis:', error);
        }
    }

    // Extracts usageMetadata from a Gemini response and logs it via the usage service.
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
     * Internal helper to execute a Gemini operation with automatic key rotation and model fallback.
     * Priority Tier 1: All free keys for each model in TEXT_MODEL_FALLBACKS
     * Priority Tier 2: All paid keys for each model in TEXT_MODEL_FALLBACKS
     */
    private async callWithFallback<T>(
        operation: (model: GenerativeModel, modelName: string) => Promise<T>,
        options?: LLMGenerativeOptions
    ): Promise<T> {
        let lastError: Error | undefined;

        const freeKeys = this.apiKeys.map((k, i) => ({ ...k, index: i })).filter(k => !k.isPaid);
        const paidKeys = this.apiKeys.map((k, i) => ({ ...k, index: i })).filter(k => k.isPaid);

        // Tiered execution: Free first, then Paid
        const tiers = [
            { name: 'Free', keys: freeKeys },
            { name: 'Paid', keys: paidKeys }
        ];

        for (const tier of tiers) {
            if (tier.keys.length === 0) continue;

            for (const modelName of AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS) {
                for (const keyConfig of tier.keys) {
                    // Quota Check for 3.1 models on free keys
                    if (modelName.includes('3.1') && !keyConfig.isPaid) {
                        const hasQuota = await this.checkQuota(modelName, keyConfig.index);
                        if (!hasQuota) continue;
                    }

                    try {
                        const client = this.clients[keyConfig.index];
                        const model = client.getGenerativeModel({
                            model: modelName,
                            systemInstruction: options?.systemInstruction
                        });

                        const result = await operation(model, modelName);
                        
                        // Increment Quota on success (only for 3.1 free keys)
                        await this.incrementQuota(modelName, keyConfig.index);
                        
                        return result;
                    } catch (error: unknown) {
                        const err = error as Error & { status?: number; response?: { status?: number }; statusCode?: number };
                        lastError = err;
                        const status = err.status || err.response?.status || err.statusCode;

                        // If 429 (Quota Exceeded), rotate to next available key/model in this tier
                        if (status === 429) {
                            logger.warn(`Gemini Model [${modelName}] with ${tier.name} Key [${keyConfig.index}] returned 429. Rotating...`);
                            continue;
                        }

                        // For other errors, throw to let the individual method retry or handle it
                        throw error;
                    }
                }
            }
        }

        throw lastError || new Error('Gemini fallback exhausted all models and keys');
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
                    maxAttempts: 2, // Low attempts since we rotate keys/models
                    initialDelay: 1000,
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
                    const textResponse = await this.generateText(prompt, {
                        ...options,
                        jsonMode: true,
                        systemInstruction: options?.systemInstruction
                            ? `${options.systemInstruction}\n\nIMPORTANT: Output strictly valid JSON matching the schema.`
                            : 'You are a helpful assistant. Output strictly valid JSON matching the schema.',
                    });

                    let cleanJson = textResponse.trim();
                    const jsonMatch = cleanJson.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                    if (jsonMatch) cleanJson = jsonMatch[0];

                    let json = JSON.parse(cleanJson);
                    if (Array.isArray(json) && typeof json[0] === 'object') json = json[0];
                    
                    return schema.parse(json);
                } catch (error: unknown) {
                    const err = error as Error & { isTransientValidation?: boolean };
                    const isValidationError = err instanceof SyntaxError || err.name === 'ZodError';
                    if (isValidationError) {
                        logger.warn('Gemini JSON validation failed, will retry...', { error: err.message });
                        err.isTransientValidation = true;
                    }
                    throw error;
                }
            },
            {
                maxAttempts: 3,
                initialDelay: 2000,
                shouldRetry: (err) => {
                    const status = err.status || err.response?.status || err.statusCode;
                    return status !== 429 && (status >= 500 || err?.isTransientValidation);
                },
                operationName: 'Gemini.generateJSON',
                signal: options?.signal
            }
        );
    }

    async generateWithTools(prompt: string, options?: LLMGenerativeOptions): Promise<{ text: string; functionCalls?: any[] }> {
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
                    maxAttempts: 2,
                    shouldRetry: (err) => {
                        const status = err.status || err.response?.status || err.statusCode;
                        return status !== 429 && status >= 500;
                    },
                    signal: options?.signal
                }
            );

            this.logUsage(response, modelName, startTime, options);
            const functionCalls = response.functionCalls();
            return functionCalls && functionCalls.length > 0 
                ? { text: response.text(), functionCalls } 
                : { text: response.text() };
        }, options);
    }

    async generateStream(prompt: string, options?: LLMGenerativeOptions): Promise<AsyncIterable<string>> {
        return this.callWithFallback(async (modelToUse) => {
            const result = await modelToUse.generateContentStream({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: options?.temperature ?? 0.7,
                    maxOutputTokens: options?.maxOutputTokens,
                },
            });

            return (async function* () {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) yield chunkText;
                }
            })();
        }, options);
    }

    async generateEmbeddings(text: string, options?: LLMGenerativeOptions): Promise<number[]> {
        // Embeddings use the default model and single key for now as per legacy, 
        // but we can apply the same logic if needed.
        try {
            const startTime = Date.now();
            const result = await withRetry(
                async () => {
                    const embeddingModel = this.clients[0].getGenerativeModel({
                        model: AGENT_CONSTANTS.DEFAULT_EMBEDDING_MODEL,
                    });
                    return await embeddingModel.embedContent(text);
                },
                { operationName: 'Gemini.generateEmbeddings' }
            );

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

            return result.embedding.values;
        } catch (error) {
            logger.error('Gemini generateEmbeddings error:', error);
            throw error;
        }
    }
}
