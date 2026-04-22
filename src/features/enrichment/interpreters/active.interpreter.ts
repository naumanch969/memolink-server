import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { ENRICHMENT_TAXONOMY, SYSTEM_PERSONAS } from '../enrichment.constants';
import { CognitiveLoad, EnergyLevel, EntityType, EnrichmentResultSchema, IEnrichmentInterpreter, IEnrichmentResult } from '../enrichment.types';

export class ActiveInterpreter implements IEnrichmentInterpreter<string, IEnrichmentResult> {
  async process(text: string): Promise<IEnrichmentResult> {
    const prompt = `${SYSTEM_PERSONAS.active}

User Input: "${text}"

Valid themes (use ONLY these, max 3): ${ENRICHMENT_TAXONOMY.join(', ')}
Valid entity types: ${EntityType.PERSON}

### EXTRACTION DISCIPLINE:
- **entities**: Extract significant people mentioned in the text. Ignore locations, concepts, projects, or organizations. Every entity MUST be typed as "${EntityType.PERSON}".
- **signal** and **coreThought** are MANDATORY and must always be provided.
- For **contradictions**, **openLoops**, **desires**, and **fears**: ONLY extract if clearly present or strongly implied. If no evidence exists, return an empty array or string.
- **energyLevel**: Choose EXACTLY ONE of: ${Object.values(EnergyLevel).map(v => `"${v}"`).join(', ')}.
- **cognitiveLoad**: Choose EXACTLY ONE of: ${Object.values(CognitiveLoad).map(v => `"${v}"`).join(', ')}.
- DO NOT hallucinate or force a psychological read where none exists.

Respond with ONLY a JSON object in this structure:
{
  "metadata": {
    "themes": ["theme1", "theme2"],
    "emotions": [{ "label": "joy", "intensity": 0.8 }],
    "entities": [{ "name": "Ahmed", "type": "${EntityType.PERSON}", "confidence": 0.95, "source": "extracted" }],
    "sentimentScore": 0.5,
    "energyLevel": "${EnergyLevel.MEDIUM}",
    "cognitiveLoad": "${CognitiveLoad.FOCUSED}"
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
      const result = await LLMService.generateJSON(prompt, EnrichmentResultSchema);
      return result;
    } catch (error) {
      logger.error('Active Interpreter failed', error);
      throw error;
    }
  }
}

export const activeInterpreter: IEnrichmentInterpreter<string, IEnrichmentResult> = new ActiveInterpreter();
