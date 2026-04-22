import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { ENRICHMENT_TAXONOMY } from '../enrichment.constants';
import { CognitiveLoad, EnergyLevel, EntityType, EnrichmentResultSchema, IEnrichmentInterpreter, IEnrichmentResult } from '../enrichment.types';

export class LogInterpreter implements IEnrichmentInterpreter<string, IEnrichmentResult> {
  /**
   * Processes a log entry.
   * Light path: Extracts themes and entities only. No narrative narrative.
   */
  async process(text: string): Promise<IEnrichmentResult> {
    const prompt = `You are the "Activity Logger". Your goal is to extract factual data from a brief activity log entry.
Do NOT generate a psychological narrative. Do NOT infer deeper meaning.

User Input: "${text}"

Valid themes (use ONLY these, max 2): ${ENRICHMENT_TAXONOMY.join(', ')}
Valid entity types: ${Object.values(EntityType).join(', ')}
- **energyLevel**: ALWAYS set to "${EnergyLevel.MEDIUM}" for logs.
- **cognitiveLoad**: ALWAYS set to "${CognitiveLoad.FOCUSED}" for logs.

Respond with ONLY a JSON object in this structure:
{
  "metadata": {
    "themes": ["theme1"],
    "emotions": [],
    "entities": [{ "name": "Name", "type": "${EntityType.PERSON}", "confidence": 0.95, "source": "extracted" }],
    "sentimentScore": 0,
    "energyLevel": "${EnergyLevel.MEDIUM}",
    "cognitiveLoad": "${CognitiveLoad.FOCUSED}"
  },
  "narrative": {
    "signal": "",
    "coreThought": "",
    "contradictions": [],
    "openLoops": [],
    "selfPerception": "",
    "desires": [],
    "fears": []
  },
  "extraction": {
    "confidenceScore": 0.8,
    "flags": ["log_tier"]
  }
}`;

    try {
      const result = await LLMService.generateJSON(prompt, EnrichmentResultSchema);
      return result;
    } catch (error) {
      logger.error('Log Interpreter failed', error);
      throw error;
    }
  }
}

export const logInterpreter: IEnrichmentInterpreter<string, IEnrichmentResult> = new LogInterpreter();
