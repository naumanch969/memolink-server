import { ZodSchema } from 'zod';
import { cacheService } from '../cache/cache.service';
import { ILLMProvider, ILLMService, LLMGenerativeOptions } from './llm.types';
import { GeminiProvider } from './providers/gemini.provider';

class LLMServiceClass implements ILLMService {
    private provider: ILLMProvider;

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
            throw new Error(`Current provider ${this.provider.name} does not support tools`);
        }
        return this.provider.generateWithTools(prompt, options);
    }

    async generateEmbeddings(text: string, options?: LLMGenerativeOptions): Promise<number[]> {
        if (!this.provider.generateEmbeddings) {
            throw new Error(`Current provider ${this.provider.name} does not support embeddings`);
        }

        const cacheKey = cacheService.getEmbeddingKey(text);
        const cached = await cacheService.get<number[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const embeddings = await this.provider.generateEmbeddings(text, options);

        // Cache the result
        await cacheService.set(cacheKey, embeddings);

        return embeddings;
    }
}


export const LLMService = new LLMServiceClass();
