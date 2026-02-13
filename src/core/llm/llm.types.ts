import { ZodSchema } from 'zod';
import { ToolDefinition } from '../../features/agent/tools/types';

export interface LLMGenerativeOptions {
    temperature?: number;
    maxOutputTokens?: number;
    jsonMode?: boolean;
    systemInstruction?: string;
    tools?: ToolDefinition[];  // Generic tool/function definitions for the provider

    // Usage tracking context (not sent to the model)
    userId?: string;
    workflow?: string;
}

export interface LLMProvider {
    name: string;
    generateText(prompt: string, options?: LLMGenerativeOptions): Promise<string>;
    generateJSON<T>(prompt: string, schema: ZodSchema<T>, options?: LLMGenerativeOptions): Promise<T>;
    generateWithTools?(prompt: string, options?: LLMGenerativeOptions): Promise<any>; // New method for tool output
    generateEmbeddings?(text: string, options?: LLMGenerativeOptions): Promise<number[]>;
}
