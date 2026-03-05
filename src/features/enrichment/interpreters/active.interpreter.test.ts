import { LLMService } from '../../../core/llm/llm.service';
import { activeInterpreter } from './active.interpreter';

jest.mock('../../../core/llm/llm.service');

describe('ActiveInterpreter', () => {
    it('should call LLM and return structured result', async () => {
        const mockLLMResult = {
            content: 'Better text',
            metadata: {
                themes: ['identity'],
                emotions: [{ label: 'curiosity', intensity: 0.8 }],
                people: [],
                sentimentScore: 0.5,
                energyLevel: 'high',
                cognitiveLoad: 'focused'
            },
            extraction: {
                confidenceScore: 0.9,
                flags: []
            }
        };

        (LLMService.generateJSON as unknown as jest.Mock).mockResolvedValue(mockLLMResult);

        const result = await activeInterpreter.process('My raw thought');

        expect(result.content).toBe('Better text');
        expect(result.metadata.themes).toContain('identity');
        expect(LLMService.generateJSON).toHaveBeenCalled();
    });
});
