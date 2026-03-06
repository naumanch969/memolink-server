import { LLMService } from '../../../core/llm/llm.service';
import { passiveInterpreter } from './passive.interpreter';

jest.mock('../../../core/llm/llm.service');

describe('PassiveInterpreter', () => {
    it('should call LLM and return structured behavioral result', async () => {
        const mockLLMResult = {
            metadata: {
                themes: ['work'],
                emotions: [{ label: 'neutral', intensity: 1.0 }],
                sentimentScore: 0,
                energyLevel: 'medium',
                cognitiveLoad: 'focused'
            },
            narrative: {
                signal: 'Behavioral summary of session.',
                coreThought: 'Deep flow work',
                contradictions: [],
                openLoops: [],
                selfPerception: '',
                desires: [],
                fears: []
            },
            extraction: {
                confidenceScore: 0.8,
                flags: ['passive_inference']
            }
        };

        (LLMService.generateJSON as unknown as jest.Mock).mockResolvedValue(mockLLMResult);

        const result = await passiveInterpreter.process('Duration: 60m. Activity: github.com: 40m');

        expect(result.narrative.signal).toBe('Behavioral summary of session.');
        expect(result.metadata.themes).toContain('work');
        expect(result.extraction.flags).toContain('passive_inference');
        expect(LLMService.generateJSON).toHaveBeenCalled();
    });
});
