import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { ENRICHMENT_TAXONOMY, SYSTEM_PERSONAS } from '../enrichment.constants';
import { IEnrichmentInterpreter } from '../enrichment.types';

const passiveEnrichmentSchema = z.object({
    metadata: z.object({
        themes: z.array(z.enum(ENRICHMENT_TAXONOMY as any)).max(3),
        emotions: z.array(z.object({
            label: z.string(),
            intensity: z.number().min(0).max(1)
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

export type IPassiveEnrichmentResult = z.infer<typeof passiveEnrichmentSchema>;

export class PassiveInterpreter implements IEnrichmentInterpreter<string, IPassiveEnrichmentResult> {
    async process(logs: string): Promise<IPassiveEnrichmentResult> {
        const prompt = `${SYSTEM_PERSONAS.PASSIVE}

Behavioral Logs:
"${logs}"

Valid themes (use ONLY these, max 3): ${ENRICHMENT_TAXONOMY.join(', ')}

### INFERENCE DISCIPLINE:
- **Do not hallucinate specific thoughts.**
- Infer **broad patterns** of work, leisure, or distraction.
- **narrative.signal**: Write 3-5 sentences about the likely mental state based on interactions (e.g., deep focus vs scattered browsing).
- **narrative.coreThought**: Identify a "psychological theme" or "behavioral center" (e.g., "Deep flow work" or "Fragmented leisure").
- **metadata.emotions**: Always neutral unless behavior is erratic (e.g., rapid context switching after a long day).
- **metadata.cognitiveLoad**: focused = single-threaded, scattered = high switching, ruminating = returning to same site repeatedly without clear progress.

Respond with ONLY a JSON object in this structure:
{
  "metadata": {
    "themes": ["work", "creativity"],
    "emotions": [{ "label": "neutral", "intensity": 1.0 }],
    "sentimentScore": 0,
    "energyLevel": "high",
    "cognitiveLoad": "focused"
  },
  "narrative": {
    "signal": "Psychological/Behavioral summary (3-5 sentences).",
    "coreThought": "Dominant behavioral driver.",
    "contradictions": [],
    "openLoops": [],
    "selfPerception": "",
    "desires": [],
    "fears": []
  },
  "extraction": {
    "confidenceScore": 0.8,
    "flags": ["passive_inference"]
  }
}`;

        try {
            const result = await LLMService.generateJSON(prompt, passiveEnrichmentSchema);
            return result;
        } catch (error) {
            logger.error('Passive Interpreter failed', error);
            throw error;
        }
    }
}

export const passiveInterpreter: IEnrichmentInterpreter<string, IPassiveEnrichmentResult> = new PassiveInterpreter();
