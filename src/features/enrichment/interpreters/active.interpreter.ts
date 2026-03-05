import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { ENRICHMENT_TAXONOMY, SYSTEM_PERSONAS } from '../enrichment.constants';
import { IEnrichmentInterpreter } from '../enrichment.types';

const activeEnrichmentSchema = z.object({
    content: z.string().describe("Condensed, high-fidelity version of the input"),
    metadata: z.object({
        themes: z.array(z.enum(ENRICHMENT_TAXONOMY as any)).max(5),
        emotions: z.array(z.object({
            label: z.string(),
            intensity: z.number().min(0).max(1)
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
        const prompt = `
      ${SYSTEM_PERSONAS.ACTIVE}
      
      User Input: "${text}"
      
      Extract the psychological signal into the following JSON structure. 
      Only use themes from this list: ${ENRICHMENT_TAXONOMY.join(', ')}.
    `;

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
