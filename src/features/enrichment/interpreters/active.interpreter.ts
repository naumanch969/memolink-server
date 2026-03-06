import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { ENRICHMENT_TAXONOMY, SYSTEM_PERSONAS } from '../enrichment.constants';
import { IEnrichmentInterpreter } from '../enrichment.types';

const activeEnrichmentSchema = z.object({
    metadata: z.object({
        themes: z.array(z.enum(ENRICHMENT_TAXONOMY as any)).max(3),
        emotions: z.array(z.object({
            label: z.string(),
            intensity: z.number().min(0).max(1)
        })),
        entities: z.array(z.object({
            name: z.string(),
            type: z.enum(['person', 'place', 'concept', 'project', 'organization']),
            confidence: z.number().min(0).max(1),
            source: z.literal('extracted')
        })),
        sentimentScore: z.number().min(-1).max(1),
        energyLevel: z.enum(['low', 'medium', 'high'] as const),
        cognitiveLoad: z.enum(['focused', 'scattered', 'ruminating'] as const),
    }),
    narrative: z.object({
        signal: z.string(),
        coreThought: z.string(),
        contradictions: z.array(z.string()),
        openLoops: z.array(z.string()),
        selfPerception: z.string(),
        desires: z.array(z.string()),
        fears: z.array(z.string()),
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

Valid themes (use ONLY these, max 3): ${ENRICHMENT_TAXONOMY.join(', ')}
Valid entity types: person, place, concept, project, organization

### EXTRACTION DISCIPLINE:
- **entities**: Extract significant people, locations, or concepts. Every entity MUST be mapped to one of the 5 valid types above.
- **signal** and **coreThought** are MANDATORY and must always be provided.
- For **contradictions**, **openLoops**, **desires**, and **fears**: ONLY extract if clearly present or strongly implied. If no evidence exists, return an empty array or string.
- For **selfPerception**: ONLY extract if the user mentions themselves or their state. Otherwise, return an empty string "".
- DO NOT hallucinate or force a psychological read where none exists.

Respond with ONLY a JSON object in this structure:
{
  "metadata": {
    "themes": ["theme1", "theme2"],
    "emotions": [{ "label": "joy", "intensity": 0.8 }],
    "entities": [{ "name": "Ahmed", "type": "person", "confidence": 0.95, "source": "extracted" }],
    "sentimentScore": 0.5,
    "energyLevel": "medium",
    "cognitiveLoad": "focused"
  },
  "narrative": {
    "signal": "Psychological interpretation (3-5 sentences).",
    "coreThought": "The distilled psychological center.",
    "contradictions": [],
    "openLoops": [],
    "selfPerception": "",
    "desires": [],
    "fears": []
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
