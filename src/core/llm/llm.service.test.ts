import { llmService } from './llm.service';
import { z } from 'zod';

// Mock GeminiProvider to avoid actual API calls during unit tests
jest.mock('./providers/gemini.provider', () => {
    return {
        GeminiProvider: jest.fn().mockImplementation(() => {
            return {
                name: 'GeminiMock',
                generateText: jest.fn().mockResolvedValue('Mocked text response'),
                generateJSON: jest.fn().mockResolvedValue({ success: true, data: 'Mocked JSON response' }),
                generateEmbeddings: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
                generateStream: jest.fn().mockImplementation(async function* () {
                    yield 'Chunk 1';
                    yield 'Chunk 2';
                }),
            };
        }),
    };
});

describe('llmService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should generate text', async () => {
        const response = await llmService.generateText('Hello');
        expect(response).toBe('Mocked text response');
    });

    it('should generate JSON', async () => {
        const schema = z.object({ success: z.boolean(), data: z.string() });
        const response = await llmService.generateJSON('Give me JSON', schema);
        expect(response).toEqual({ success: true, data: 'Mocked JSON response' });
    });

    it('should generate embeddings', async () => {
        const response = await llmService.generateEmbeddings('Test text');
        expect(response).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle streaming', async () => {
        const stream = await llmService.generateStream('Stream this');
        const chunks: string[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        expect(chunks).toEqual(['Chunk 1', 'Chunk 2']);
    });
});
