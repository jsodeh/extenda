/**
 * Error handling utilities with retry logic
 */

export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
}

export class ErrorHandler {
    /**
     * Execute function with exponential backoff retry
     */
    static async withRetry<T>(
        fn: () => Promise<T>,
        options: RetryOptions = {}
    ): Promise<T> {
        const {
            maxAttempts = 3,
            initialDelayMs = 1000,
            maxDelayMs = 10000,
            backoffMultiplier = 2
        } = options;

        let lastError: Error | undefined;
        let delayMs = initialDelayMs;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Don't retry on last attempt
                if (attempt === maxAttempts) {
                    break;
                }

                // Check if error is retryable
                if (!this.isRetryable(error)) {
                    throw lastError;
                }

                // Log retry attempt
                console.warn(
                    `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. ` +
                    `Retrying in ${delayMs}ms...`
                );

                // Wait before retrying
                await this.delay(delayMs);

                // Increase delay for next attempt (exponential backoff)
                delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
            }
        }

        throw lastError;
    }

    /**
     * Check if error should be retried
     */
    private static isRetryable(error: any): boolean {
        // Retry on network errors
        if (error.message?.includes('network') || error.message?.includes('timeout')) {
            return true;
        }

        // Retry on rate limit errors (HTTP 429)
        if (error.status === 429 || error.message?.includes('rate limit')) {
            return true;
        }

        // Retry on server errors (HTTP 5xx)
        if (error.status >= 500 && error.status < 600) {
            return true;
        }

        // Don't retry on client errors (HTTP 4xx except 429)
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
            return false;
        }

        // Default: retry
        return true;
    }

    /**
     * Extract retry-after delay from error or headers
     */
    static getRetryAfterMs(error: any, headers?: Headers): number | null {
        // Check Retry-After header
        if (headers?.has('retry-after')) {
            const retryAfter = headers.get('retry-after');
            if (retryAfter) {
                // Parse as seconds or date
                const seconds = parseInt(retryAfter, 10);
                if (!isNaN(seconds)) {
                    return seconds * 1000;
                }
            }
        }

        // Check error message for rate limit info
        const match = error.message?.match(/retry after (\d+)/i);
        if (match) {
            return parseInt(match[1], 10) * 1000;
        }

        return null;
    }

    /**
     * Delay execution
     */
    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Handle rate limiting with Retry-After
     */
    static async withRateLimit<T>(
        fn: () => Promise<{ data: T; headers?: Headers }>,
        options: RetryOptions = {}
    ): Promise<T> {
        const { maxAttempts = 3 } = options;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await fn();
                return result.data;
            } catch (error: any) {
                if (error.status === 429) {
                    const retryAfterMs = this.getRetryAfterMs(error, error.headers);

                    if (retryAfterMs && attempt < maxAttempts) {
                        console.warn(
                            `Rate limited. Waiting ${retryAfterMs}ms before retry...`
                        );
                        await this.delay(retryAfterMs);
                        continue;
                    }
                }

                throw error;
            }
        }

        throw new Error('Max retry attempts exceeded');
    }
}

/**
 * Decorator for adding retry logic to adapter methods
 */
export function withRetry(options?: RetryOptions) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            return ErrorHandler.withRetry(
                () => originalMethod.apply(this, args),
                options
            );
        };

        return descriptor;
    };
}
