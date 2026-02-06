import { logger } from '../../config/logger';

interface RetryOptions {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
    operationName?: string;
}

/**
 * Executes an asynchronous operation with exponential backoff retry logic.
 * Designed to be lean and minimize latency impact for non-transient errors.
 */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
        maxAttempts = 3,
        initialDelay = 500, // ms
        maxDelay = 5000,    // ms
        shouldRetry = (err) => {
            // Check for status code in various possible locations
            const status = err.status || err.response?.status || err.statusCode;
            if (status === 429 || (status >= 500 && status < 600)) return true;

            // Fallback: check error message for common transient/retryable keywords
            const message = (err.message || '').toLowerCase();
            const transientKeywords = [
                'rate limit',
                'too many requests',
                'resource exhausted',
                'deadline exceeded',
                'service unavailable',
                'internal server error',
                'transient',
                'socket hang up',
                'etimedout'
            ];

            return transientKeywords.some(keyword => message.includes(keyword));
        },
        operationName = 'Operation'
    } = options;

    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            const canRetry = attempt < maxAttempts && shouldRetry(error);

            if (!canRetry) {
                if (attempt > 1) {
                    logger.error(`${operationName} failed after ${attempt} attempts:`, error);
                }
                throw error;
            }

            // Exponential backoff with jitter
            const backoff = Math.min(
                maxDelay,
                initialDelay * Math.pow(2, attempt - 1)
            );
            const jitter = Math.random() * 200; // Small randomized delay
            const delay = backoff + jitter;

            logger.warn(`${operationName} transient error (Attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delay)}ms...`, {
                status: error.status || error.response?.status,
                message: error.message
            });

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}
