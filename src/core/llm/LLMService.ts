import { ZodSchema } from 'zod';
import { GeminiProvider } from './providers/GeminiProvider';
import { LLMGenerativeOptions, LLMProvider } from './types';
import { CacheService } from '../cache/CacheService';

class LLMServiceClass {
    private provider: LLMProvider;

    constructor() {
        // Default to Gemini for now. 
        // In the future, we can inject different providers based on config or user preference.
        this.provider = new GeminiProvider();
    }

    /**
     * Generate raw text from a prompt
     */
    async generateText(prompt: string, options?: LLMGenerativeOptions): Promise<string> {
        return this.provider.generateText(prompt, options);
    }

    /**
     * Generate structured data matching a Zod schema
     */
    async generateJSON<T>(prompt: string, schema: ZodSchema<T>, options?: LLMGenerativeOptions): Promise<T> {
        return this.provider.generateJSON(prompt, schema, options);
    }

    /**
     * Generate content allowing for tool usage (function calling)
     */
    async generateWithTools(prompt: string, options?: LLMGenerativeOptions): Promise<any> {
        if (!this.provider.generateWithTools) {
            throw new Error('Current provider does not support tools');
        }
        return this.provider.generateWithTools(prompt, options);
    }

    async generateEmbeddings(text: string): Promise<number[]> {
        if (!this.provider.generateEmbeddings) {
            throw new Error('Current provider does not support embeddings');
        }

        const cacheKey = CacheService.getEmbeddingKey(text);
        const cached = await CacheService.get<number[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const embeddings = await this.provider.generateEmbeddings(text);

        // Cache the result
        await CacheService.set(cacheKey, embeddings);

        return embeddings;
    }
}

export const LLMService = new LLMServiceClass();
