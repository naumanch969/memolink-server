import { llmService } from '../../../core/llm/llm.service';
import { activeInterpreter } from './active.interpreter';

jest.mock('../../../core/llm/llm.service');

describe('ActiveInterpreter', () => {
    it('should call LLM and return structured result', async () => {
        const mockLLMResult = {
            metadata: {
                themes: ['identity'],
                emotions: [{ label: 'curiosity', intensity: 0.8 }],
                entities: [],
                sentimentScore: 0.5,
                energyLevel: 'high',
                cognitiveLoad: 'focused'
            },
            narrative: {
                signal: 'Psychological interpretation',
                coreThought: 'Dominant thought',
                contradictions: [],
                openLoops: [],
                selfPerception: 'Capable',
                desires: [],
                fears: []
            },
            extraction: {
                confidenceScore: 0.9,
                flags: []
            }
        };

        (llmService.generateJSON as unknown as jest.Mock).mockResolvedValue(mockLLMResult);

        const result = await activeInterpreter.process('My raw thought');

        expect(result.narrative.signal).toBe('Psychological interpretation');
        expect(result.metadata.themes).toContain('identity');
        expect(llmService.generateJSON).toHaveBeenCalled();
    });
});
