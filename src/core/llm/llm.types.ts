import { Types } from 'mongoose';
import { ZodSchema } from 'zod';

export interface LLMGenerativeOptions {
    temperature?: number;
    maxOutputTokens?: number;
    jsonMode?: boolean;
    systemInstruction?: string;
    tools?: any[];  // Generic tool/function definitions for the provider
    signal?: AbortSignal;

    // Usage tracking context (not sent to the model)
    userId?: string | Types.ObjectId;
    workflow?: string;
}

export interface IllmService {
    generateText(prompt: string, options?: LLMGenerativeOptions): Promise<string>
    generateJSON<T>(prompt: string, schema: ZodSchema<T>, options?: LLMGenerativeOptions): Promise<T>
    generateWithTools(prompt: string, options?: LLMGenerativeOptions): Promise<any>
    generateStream(prompt: string, options?: LLMGenerativeOptions): Promise<AsyncIterable<string>>
    generateEmbeddings(text: string, options?: LLMGenerativeOptions): Promise<number[]>
}

export interface ILLMProvider {
    name: string;
    generateText(prompt: string, options?: LLMGenerativeOptions): Promise<string>;
    generateJSON<T>(prompt: string, schema: ZodSchema<T>, options?: LLMGenerativeOptions): Promise<T>;
    generateWithTools?(prompt: string, options?: LLMGenerativeOptions): Promise<any>;
    generateStream?(prompt: string, options?: LLMGenerativeOptions): Promise<AsyncIterable<string>>;
    generateEmbeddings?(text: string, options?: LLMGenerativeOptions): Promise<number[]>;
}
