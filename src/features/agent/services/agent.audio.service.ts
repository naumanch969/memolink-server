import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../../config/logger';
import { withRetry } from '../../../core/utils/retry.utils';
import { llmUsageService } from '../../llm-usage/llm-usage.service';
import { AGENT_CONSTANTS } from '../agent.constants';
import { IAudioTranscriptionService } from '../agent.interfaces';

/**
 * Audio Transcription Service
 * Uses Gemini's native multimodal capabilities to transcribe audio files.
 * Supports: mp3, wav, m4a, webm, ogg, aac, caf, mp4 audio
 */
class AudioTranscriptionService implements IAudioTranscriptionService {
    private client: GoogleGenerativeAI;

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is required for audio transcription');
        }
        this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    /**
     * Transcribe audio buffer to text using Gemini multimodal
     */
    async transcribe(
        audioBuffer: Buffer,
        mimeType: string,
        options?: { userId?: string; language?: string }
    ): Promise<{ text: string; confidence: 'high' | 'medium' | 'low' }> {
        const model = this.client.getGenerativeModel({ model: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL });
        const base64Audio = audioBuffer.toString('base64');

        const languageHint = options?.language
            ? `The audio is likely in ${options.language}.`
            : 'Detect the language automatically.';

        const prompt = `You are a precise audio transcription engine. Transcribe the following audio recording into text.

Rules:
- Output ONLY the transcribed text, nothing else
- Preserve the speaker's words exactly as spoken
- Use proper punctuation and capitalization
- If the audio is unclear or silent, output exactly: [inaudible]
- If there are multiple speakers, prefix with "Speaker 1:", "Speaker 2:", etc.
- If the speech is in a non-English language (e.g. Hindi, Urdu, Spanish), transcribe it phonetically into Roman English (using the English alphabet). Do NOT translate the content into English. Do NOT use the native script.
- ${languageHint}

Output strictly valid JSON:
{"text": "<transcribed text>", "confidence": "high" | "medium" | "low"}`;

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
                                        mimeType: this.normalizeMimeType(mimeType),
                                        data: base64Audio,
                                    },
                                },
                            ],
                        }],
                        generationConfig: {
                            temperature: 0.1, // Low for accuracy
                            responseMimeType: 'application/json',
                        },
                    });
                    return result.response;
                },
                { operationName: 'AudioTranscription' }
            );

            // Log usage
            const usage = response.usageMetadata;
            if (usage) {
                llmUsageService.log({
                    userId: options?.userId ?? 'system',
                    workflow: 'audio-transcription',
                    modelName: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL,
                    promptTokens: usage.promptTokenCount ?? 0,
                    completionTokens: usage.candidatesTokenCount ?? 0,
                    totalTokens: usage.totalTokenCount ?? 0,
                    durationMs: Date.now() - startTime,
                });
            }

            const rawText = response.text().trim();
            let parsed: { text: string; confidence: string };

            try {
                // Clean markdown fences if present
                const cleaned = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
                parsed = JSON.parse(cleaned);
            } catch {
                // Fallback: treat the entire response as the transcription
                logger.warn('Audio transcription: Could not parse JSON response, using raw text');
                parsed = { text: rawText, confidence: 'medium' };
            }

            if (!parsed.text || parsed.text === '[inaudible]') {
                logger.warn('Audio transcription returned empty or inaudible', { userId: options?.userId });
                return { text: '', confidence: 'low' };
            }

            logger.info('Audio transcribed successfully', {
                userId: options?.userId,
                durationMs: Date.now() - startTime,
                textLength: parsed.text.length,
                confidence: parsed.confidence,
            });

            return {
                text: parsed.text,
                confidence: (parsed.confidence as 'high' | 'medium' | 'low') || 'medium',
            };
        } catch (error) {
            logger.error('Audio transcription failed', error);
            throw error;
        }
    }

    /**
     * Normalize MIME type to what Gemini accepts
     */
    private normalizeMimeType(mime: string): string {
        const normalizations: Record<string, string> = {
            'audio/mp3': 'audio/mpeg',
            'audio/x-wav': 'audio/wav',
            'audio/x-m4a': 'audio/mp4',
            'audio/m4a': 'audio/mp4',
            'audio/x-caf': 'audio/mp4', // Best approximation for CAF
            'audio/ogg; codecs=opus': 'audio/ogg',
        };
        return normalizations[mime] || mime;
    }
}

export const audioTranscriptionService = new AudioTranscriptionService();
