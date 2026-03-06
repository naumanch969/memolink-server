import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { ENRICHMENT_TAXONOMY, SYSTEM_PERSONAS } from '../enrichment.constants';
import { IEnrichmentInterpreter } from '../enrichment.types';

const activeEnrichmentSchema = z.object({
    content: z.string(),
    metadata: z.object({
        themes: z.array(z.enum(ENRICHMENT_TAXONOMY as any)).max(5),
        emotions: z.array(z.object({
            name: z.string(),
            score: z.number().min(0).max(1),
            icon: z.string()
        })),
        people: z.array(z.object({
            name: z.string(),
            role: z.string(),
            sentiment: z.number().min(-1).max(1)
        })),
        sentimentScore: z.number().min(-1).max(1),
        energyLevel: z.enum(['low', 'medium', 'high'] as const),
        cognitiveLoad: z.enum(['focused', 'scattered', 'ruminating'] as const),
    }),
    extraction: z.object({
        confidenceScore: z.number().min(0).max(1),
        flags: z.array(z.string())
    })
});

export type IActiveEnrichmentResult = z.infer<typeof activeEnrichmentSchema>;

export class ActiveInterpreter implements IEnrichmentInterpreter<string, IActiveEnrichmentResult> {
    async process(text: string): Promise<IActiveEnrichmentResult> {
        const prompt = `${SYSTEM_PERSONAS.ACTIVE}

User Input: "${text}"

Valid themes (use ONLY these): ${ENRICHMENT_TAXONOMY.join(', ')}

Respond with ONLY a JSON object in this exact structure — no wrapper keys, no markdown, no explanation:
{
  "content": "<condensed narrative of the input>",
  "metadata": {
    "themes": ["<theme1>", "<theme2>"],
    "emotions": [{ "name": "<emotion name>", "score": 0.8, "icon": "<single emoji>" }],
    "people": [{ "name": "<name>", "role": "<role>", "sentiment": 0.5 }],
    "sentimentScore": 0.3,
    "energyLevel": "medium",
    "cognitiveLoad": "focused"
  },
  "extraction": {
    "confidenceScore": 0.9,
    "flags": []
  }
}`;

        try {
            const result = await LLMService.generateJSON(prompt, activeEnrichmentSchema);
            return result;
        } catch (error) {
            logger.error('Active Interpreter failed', error);
            throw error;
        }
    }
}

export const activeInterpreter: IEnrichmentInterpreter<string, IActiveEnrichmentResult> = new ActiveInterpreter();
