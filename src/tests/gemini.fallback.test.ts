import { GeminiProvider } from '../core/llm/providers/gemini.provider';
import { AGENT_CONSTANTS } from '../features/agent/agent.constants';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the logger to avoid polluting test output
jest.mock('../config/logger', () => ({
    logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    }
}));

// Mock the Google SDK
jest.mock('@google/generative-ai');

describe('GeminiProvider Fallback Logic', () => {
    let provider: GeminiProvider;
    let mockGetGenerativeModel: jest.Mock;
    let mockGenerateContent: jest.Mock;

    beforeEach(() => {
        process.env.GEMINI_API_KEY = 'test-key';
        
        mockGenerateContent = jest.fn();
        mockGetGenerativeModel = jest.fn().mockReturnValue({
            generateContent: mockGenerateContent,
            // Add other methods if needed for other tests
        });

        (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
            getGenerativeModel: mockGetGenerativeModel,
        }));

        provider = new GeminiProvider();
        jest.clearAllMocks();
    });

    it('should fallback to the next model if the first one returns 429', async () => {
        // First call to generateContent throws 429
        mockGenerateContent
            .mockRejectedValueOnce({ status: 429, message: 'Quota exceeded' })
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Fallback successful',
                    functionCalls: () => [],
                },
            });

        const result = await provider.generateText('test prompt');

        expect(result).toBe('Fallback successful');
        
        // Should have called getGenerativeModel twice
        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2);
        
        // First call should be with the default model
        expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(1, { model: AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS[0] });
        
        // Second call should be with the next model in fallbacks
        expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(2, { model: AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS[1] });
    });

    it('should keep falling back until it succeeds or runs out of models', async () => {
        // Throw 429 for the first two models
        mockGenerateContent
            .mockRejectedValueOnce({ status: 429, message: 'Quota 1' })
            .mockRejectedValueOnce({ status: 429, message: 'Quota 2' })
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Fallback successful at third model',
                    functionCalls: () => [],
                },
            });

        const result = await provider.generateText('test prompt');

        expect(result).toBe('Fallback successful at third model');
        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(3);
        expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(1, { model: AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS[0] });
        expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(2, { model: AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS[1] });
        expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(3, { model: AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS[2] });
    });

    it('should throw the final error if all models fail with 429', async () => {
        // Mock all fallbacks to fail
        for (let i = 0; i < AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS.length; i++) {
            mockGenerateContent.mockRejectedValueOnce({ status: 429, message: `Final fail at ${i}` });
        }

        await expect(provider.generateText('test prompt')).rejects.toMatchObject({
            status: 429,
            message: expect.stringContaining('Final fail')
        });

        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS.length);
    });

    it('should NOT fallback for non-429 errors', async () => {
        // Throw a 400 error
        mockGenerateContent.mockRejectedValueOnce({ status: 400, message: 'Bad Request' });

        await expect(provider.generateText('test prompt')).rejects.toMatchObject({
            status: 400,
            message: 'Bad Request'
        });

        // Should have only tried the first model
        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
    });
});
