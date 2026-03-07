import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { ENRICHMENT_TAXONOMY, SYSTEM_PERSONAS } from '../enrichment.constants';
import { EnrichmentResultSchema, IEnrichmentInterpreter, IEnrichmentResult } from '../enrichment.types';

export class PassiveInterpreter implements IEnrichmentInterpreter<string, IEnrichmentResult> {
    async process(logs: string): Promise<IEnrichmentResult> {
        const prompt = `${SYSTEM_PERSONAS.passive}

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
- **metadata.entities**: Only extract if the behavioral logs mentions specific projects, entities, or people (e.g. from app names or page titles). 

Respond with ONLY a JSON object in this structure:
{
  "metadata": {
    "themes": ["work", "creativity"],
    "emotions": [{ "label": "neutral", "intensity": 1.0 }],
    "entities": [],
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
            const result = await LLMService.generateJSON(prompt, EnrichmentResultSchema);
            return result;
        } catch (error) {
            logger.error('Passive Interpreter failed', error);
            throw error;
        }
    }
}

export const passiveInterpreter: IEnrichmentInterpreter<string, IEnrichmentResult> = new PassiveInterpreter();
