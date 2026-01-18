import { ZodSchema } from 'zod';

export interface LLMGenerativeOptions {
    temperature?: number;
    maxOutputTokens?: number;
    jsonMode?: boolean;
    systemInstruction?: string;
}

export interface LLMProvider {
    name: string;
    generateText(prompt: string, options?: LLMGenerativeOptions): Promise<string>;
    generateJSON<T>(prompt: string, schema: ZodSchema<T>, options?: LLMGenerativeOptions): Promise<T>;
}
