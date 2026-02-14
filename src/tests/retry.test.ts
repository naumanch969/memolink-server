import { withRetry } from '../core/utils/retry.util';

// Mock logger to avoid cluttering test output
jest.mock('../config/logger', () => ({
    logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    }
}));

describe('withRetry Utility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return result if operation succeeds on first attempt', async () => {
        const operation = jest.fn().mockResolvedValue('success');
        const result = await withRetry(operation);

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed if operation fails once with transient error', async () => {
        const operation = jest.fn()
            .mockRejectedValueOnce({ status: 429 })
            .mockResolvedValueOnce('success');

        const result = await withRetry(operation, { initialDelay: 5 }); // fast delay for tests

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail immediately on non-transient error (e.g., 400)', async () => {
        const operation = jest.fn().mockRejectedValue({ status: 400 });

        await expect(withRetry(operation, { initialDelay: 5 }))
            .rejects.toMatchObject({ status: 400 });

        expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust all attempts and throw last error if transient failures persist', async () => {
        const error = { status: 503, message: 'Service Unavailable' };
        const operation = jest.fn().mockRejectedValue(error);

        await expect(withRetry(operation, { maxAttempts: 3, initialDelay: 5 }))
            .rejects.toMatchObject(error);

        expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect custom shouldRetry condition', async () => {
        const operation = jest.fn()
            .mockRejectedValueOnce(new Error('custom error'))
            .mockResolvedValueOnce('success');

        const result = await withRetry(operation, {
            initialDelay: 5,
            shouldRetry: (err) => err.message === 'custom error'
        });

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff (partial check via timing)', async () => {
        const operation = jest.fn().mockRejectedValue({ status: 500 });
        const start = Date.now();

        // maxAttempts: 2, delay will be ~500ms + jitter
        // but we'll use small initial delay to keep test fast
        await expect(withRetry(operation, { maxAttempts: 2, initialDelay: 100 }))
            .rejects.toBeDefined();

        const duration = Date.now() - start;
        // Should be at least 100ms
        expect(duration).toBeGreaterThanOrEqual(100);
    });
});
