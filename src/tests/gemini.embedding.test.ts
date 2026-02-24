import { GeminiProvider } from '../core/llm/providers/gemini.provider';

// Mock the logger
jest.mock('../config/logger', () => ({
    logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    }
}));

// Mock the Google SDK
const mockEmbedContent = jest.fn();
jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockImplementation(() => ({
                embedContent: mockEmbedContent,
            })),
        })),
    };
});

describe('GeminiProvider.generateEmbeddings', () => {
    let provider: GeminiProvider;

    beforeEach(() => {
        process.env.GEMINI_API_KEY = 'test-key';
        provider = new GeminiProvider();
        jest.clearAllMocks();
    });

    it('should generate embeddings successfully', async () => {
        const mockValues = [0.1, 0.2, 0.3];

        // Mocking the structure based on what I suspect is correct (result.embedding.values)
        // BUT the current implementation uses result.response.embedding.values
        mockEmbedContent.mockResolvedValue({
            embedding: { values: mockValues }
        });

        try {
            const result = await provider.generateEmbeddings('test text');
            expect(result).toEqual(mockValues);
        } catch (error) {
            // If it fails with "Cannot read property 'embedding' of undefined", it means it tried result.response.embedding
            console.log('Caught expected error due to incorrect structure access:', error.message);
            throw error;
        }
    });

    it('should handle API errors', async () => {
        mockEmbedContent.mockRejectedValue(new Error('API Error'));

        await expect(provider.generateEmbeddings('test text')).rejects.toThrow('API Error');
    });
});
