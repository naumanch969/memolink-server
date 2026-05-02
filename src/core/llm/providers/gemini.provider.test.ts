import { GeminiProvider } from './gemini.provider';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { redisConnection } from '../../../config/redis';

// Mock config before importing GeminiProvider
jest.mock('../../../config/env', () => ({
    config: {
        GEMINI_API_KEY: 'free-key-1',
        GEMINI_API_KEY_2: 'free-key-2',
        GEMINI_API_KEY_3: 'free-key-3',
        PAID_GEMINI_API_KEY: 'paid-key-1',
    }
}));

// Mock the GoogleGenerativeAI SDK
jest.mock('@google/generative-ai');
jest.mock('../../../config/redis', () => ({
    redisConnection: {
        get: jest.fn(),
        multi: jest.fn().mockReturnValue({
            incr: jest.fn().mockReturnThis(),
            expire: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([]),
        }),
    },
}));

describe('GeminiProvider Tiered Fallback Logic', () => {
    let provider: GeminiProvider;
    let mockModel: any;

    beforeEach(() => {
        jest.resetAllMocks();
        mockModel = {
            generateContent: jest.fn(),
            embedContent: jest.fn(),
        };
        (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue(mockModel),
        }));
        provider = new GeminiProvider();
    });

    it('should rotate free keys on 429 error within the same model', async () => {
        // Setup: Fail Key 0, succeed on Key 1 (both free)
        mockModel.generateContent
            .mockRejectedValueOnce({ status: 429 }) // Free Key 0
            .mockResolvedValueOnce({               // Free Key 1
                response: {
                    text: () => 'Success on second free key',
                    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
                },
            });

        const response = await provider.generateText('Test prompt');
        
        expect(response).toBe('Success on second free key');
        expect(mockModel.generateContent).toHaveBeenCalledTimes(2);
    });

    it('should fall back to next model using free keys BEFORE using paid key for primary model', async () => {
        /**
         * Expected Sequence:
         * 1. Tier 1 (Free):
         *    - Model 1 (3.1): Free Key 0 (fail), Free Key 1 (fail), Free Key 2 (fail)
         *    - Model 2 (2.5): Free Key 0 (success)
         */
        mockModel.generateContent
            .mockRejectedValueOnce({ status: 429 }) // M1, K0 (Free)
            .mockRejectedValueOnce({ status: 429 }) // M1, K1 (Free)
            .mockRejectedValueOnce({ status: 429 }) // M1, K2 (Free)
            .mockResolvedValueOnce({               // M2, K0 (Free) - This comes before Paid Key for M1
                response: {
                    text: () => 'Success on second model free key',
                    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
                },
            });

        const response = await provider.generateText('Test prompt');
        
        expect(response).toBe('Success on second model free key');
        // If it were old logic, it would have called M1, K3 (Paid) here.
        // With tiered logic, it tries M2, K0 (Free) first.
        expect(mockModel.generateContent).toHaveBeenCalledTimes(4);
    });

    it('should use paid key only after exhausting all free models', async () => {
        /**
         * Expected Sequence:
         * 1. Tier 1 (Free):
         *    - M1: K0, K1, K2 (all fail)
         *    - M2: K0, K1, K2 (all fail)
         * 2. Tier 2 (Paid):
         *    - M1: K3 (success)
         */
        for (let i = 0; i < 6; i++) {
            mockModel.generateContent.mockRejectedValueOnce({ status: 429 });
        }
        mockModel.generateContent.mockResolvedValueOnce({
            response: {
                text: () => 'Success on paid key',
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
            },
        });

        const response = await provider.generateText('Test prompt');
        
        expect(response).toBe('Success on paid key');
        expect(mockModel.generateContent).toHaveBeenCalledTimes(7);
    });

    it('should enforce quota for 3.1 models and skip to next key', async () => {
        // Mock Redis to say quota is exceeded for Free Key 0
        (redisConnection.get as jest.Mock).mockImplementation((key: string) => {
            if (key.includes('rpm:0')) return Promise.resolve('15'); // RPM limit reached
            return Promise.resolve(null);
        });

        mockModel.generateContent.mockResolvedValue({
            response: {
                text: () => 'Success on free key 1',
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
            },
        });

        const response = await provider.generateText('Test prompt');

        expect(response).toBe('Success on free key 1');
        // Free Key 0 skipped due to quota check, first call is to Free Key 1
        expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
    });
});
