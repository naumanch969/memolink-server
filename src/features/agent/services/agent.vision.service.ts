import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../../config/logger';
import { withRetry } from '../../../core/utils/retry.utils';
import { llmUsageService } from '../../llm-usage/llm-usage.service';
import { AGENT_CONSTANTS } from '../agent.constants';
import { config } from '../../../config/env';

/**
 * Vision Service
 * Uses Gemini's multimodal capabilities to analyze images and documents (PDFs).
 */
class VisionService {
    private client: GoogleGenerativeAI;

    constructor() {
        if (!config.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is required for vision service');
        }
        this.client = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    }

    // Analyze image or document buffer using Gemini multimodal
    async analyze(buffer: Buffer, mimeType: string, prompt: string, options?: { userId?: string; workflow?: string }): Promise<any> {
        const model = this.client.getGenerativeModel({ model: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL });
        const base64Data = buffer.toString('base64');

        const startTime = Date.now();

        try {
            const response = await withRetry(
                async () => {
                    const result = await model.generateContent({
                        contents: [{
                            role: 'user',
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Data,
                                    },
                                },
                            ],
                        }],
                        generationConfig: {
                            temperature: 0.2,
                            responseMimeType: 'application/json',
                        },
                    });
                    return result.response;
                },
                { operationName: 'VisionAnalysis' }
            );

            // Log usage
            const usage = response.usageMetadata;
            if (usage) {
                llmUsageService.log({
                    userId: options?.userId ?? 'system',
                    workflow: options?.workflow ?? 'vision-analysis',
                    modelName: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL,
                    promptTokens: usage.promptTokenCount ?? 0,
                    completionTokens: usage.candidatesTokenCount ?? 0,
                    totalTokens: usage.totalTokenCount ?? 0,
                    durationMs: Date.now() - startTime,
                });
            }

            const rawText = response.text().trim();
            try {
                const cleaned = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
                return JSON.parse(cleaned);
            } catch {
                logger.warn('Vision analysis: Could not parse JSON response, using raw text');
                return { text: rawText };
            }
        } catch (error) {
            logger.error('Vision analysis failed', error);
            throw error;
        }
    }
}

export const visionService = new VisionService();
