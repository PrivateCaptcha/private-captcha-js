
/**
 * HTTP Error with status code
 * @property {number} statusCode - HTTP status code
 * @property {number|null} retryAfterSeconds - Retry-After header value in seconds
 */
export class HTTPError extends Error {
    /**
     * @param {number} statusCode - HTTP status code
     * @param {string} [message] - Error message
     */
    constructor(statusCode, message) {
        super(message || `HTTP Error ${statusCode}`);
        this.name = 'HTTPError';
        this.statusCode = statusCode;
        this.retryAfterSeconds = null;
    }
}

/**
 * Verification Error with attempt tracking
 * @property {Error} originalError - The original error that occurred
 * @property {number} attempt - Number of attempts made during verification
 */
export class VerificationError extends Error {
    /**
     * @param {string} message - Error message
     * @param {Error} originalError - The original error
     * @param {number} [attempt=0] - Number of attempts made
     */
    constructor(message, originalError, attempt = 0) {
        super(message);
        this.name = 'VerificationError';
        this.originalError = originalError;
        this.attempt = attempt;
    }
}

/**
 * Solution Error for missing or empty solutions/form fields
 */
export class SolutionError extends Error {
    /**
     * @param {string} message - Error message
     */
    constructor(message) {
        super(message);
        this.name = 'SolutionError';
    }
}

/**
 * Gets the HTTP status code from an error if it's an HTTPError
 * @param {Error} error - The error to check
 * @returns {[number, boolean]} - Tuple of [statusCode, isHTTPError]
 */
export function getStatusCode(error) {
    if (error instanceof HTTPError) {
        return [error.statusCode, true];
    }
    if (error instanceof VerificationError && error.originalError instanceof HTTPError) {
        return [error.originalError.statusCode, true];
    }
    return [0, false];
}

// Constants
export const GlobalDomain = 'api.privatecaptcha.com';
export const EUDomain = 'api.eu.privatecaptcha.com';
export const DefaultFormField = 'private-captcha-solution';
const version = '0.0.4'
const userAgent = 'private-captcha-js/' + version;

const retriableStatusCodes = [
    408, // Request Timeout
    425, // Too Early
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
];

/**
 * Verify codes
 */
export const VerifyCode = {
    VerifyNoError: 0,
    VerifyErrorOther: 1,
    DuplicateSolutionsError: 2,
    InvalidSolutionError: 3,
    ParseResponseError: 4,
    PuzzleExpiredError: 5,
    InvalidPropertyError: 6,
    WrongOwnerError: 7,
    VerifiedBeforeError: 8,
    MaintenanceModeError: 9,
    TestPropertyError: 10,
    IntegrityError: 11
};

/**
 * Gets string representation of verify code
 * @param {number} code - The verify code
 * @returns {string} - String representation
 */
export function verifyCodeToString(code) {
    switch (code) {
        case VerifyCode.VerifyNoError:
            return '';
        case VerifyCode.VerifyErrorOther:
            return 'error-other';
        case VerifyCode.DuplicateSolutionsError:
            return 'solution-duplicates';
        case VerifyCode.InvalidSolutionError:
            return 'solution-invalid';
        case VerifyCode.ParseResponseError:
            return 'solution-bad-format';
        case VerifyCode.PuzzleExpiredError:
            return 'puzzle-expired';
        case VerifyCode.InvalidPropertyError:
            return 'property-invalid';
        case VerifyCode.WrongOwnerError:
            return 'property-owner-mismatch';
        case VerifyCode.VerifiedBeforeError:
            return 'solution-verified-before';
        case VerifyCode.MaintenanceModeError:
            return 'maintenance-mode';
        case VerifyCode.TestPropertyError:
            return 'property-test';
        case VerifyCode.IntegrityError:
            return 'integrity-error';
        default:
            return 'error';
    }
}

/**
 * @typedef {Object} Configuration
 * @property {string} [domain] - Domain name when used with self-hosted version
 * @property {string} apiKey - API key created in Private Captcha account settings
 * @property {string} [formField] - Custom form field to read puzzle solution from
 * @property {number} [failedStatusCode] - HTTP status to return for failed verifications
 * @property {Function} [logger] - Debug logger function (e.g., console.debug)
 * @property {number} [timeoutMs] - Request timeout in milliseconds
 */

/**
 * @typedef {Object} VerifyInput
 * @property {string} solution - The captcha solution
 * @property {number} [maxBackoffSeconds] - Maximum backoff time in seconds
 * @property {number} [attempts] - Number of retry attempts
 */

/**
 * @typedef {Object} VerifyOutput
 * @property {boolean} success - Whether verification succeeded
 * @property {number} code - Verification result code
 * @property {string} [origin] - Origin of the request
 * @property {string} [timestamp] - Timestamp of verification
 * @property {string} requestID - Request ID for tracing
 */

/**
 * Private Captcha API Client
 */
export class Client {
    /**
     * @param {Configuration} config - Configuration object
     */
    constructor(config) {
        if (!config.apiKey || config.apiKey.length === 0) {
            throw new Error('privatecaptcha: API key is empty');
        }

        let domain = config.domain || GlobalDomain;
        if (domain.startsWith('http')) {
            domain = domain.replace(/^https?:\/\//, '');
        }

        this.endpoint = `https://${domain.trimEnd('/')}/verify`;
        this.apiKey = config.apiKey;
        this.formField = config.formField || DefaultFormField;
        this.failedStatusCode = config.failedStatusCode || 403;
        this.timeoutMs = config.timeoutMs || 30000; // Default 30 seconds
        this.logger = config.logger;
    }

    /**
     * Log debug message if logger is configured
     * @private
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    _log(message, ...args) {
        if (this.logger) {
            this.logger(`[private-captcha] ${message}`, ...args);
        }
    }

    /**
     * Internal method to perform verification request
     * @private
     * @param {string} solution - The captcha solution
     * @returns {Promise<VerifyOutput>} - Verification result
     */
    async _doVerify(solution) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'X-Api-Key': this.apiKey,
                    'Content-Type': 'text/plain',
                    'User-Agent': userAgent
                },
                body: solution,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            this._log('HTTP request finished', { endpoint: this.endpoint, status: response.status });

            let retryAfterSeconds = null;
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const rateLimit = response.headers.get('X-RateLimit-Limit');
                this._log('Rate limited', { retryAfter, rateLimit });

                if (retryAfter) {
                    const value = parseInt(retryAfter, 10);
                    if (!isNaN(value)) {
                        retryAfterSeconds = value;
                    }
                }
            }

            // Throw HTTPError for all non-2xx status codes
            if (response.status >= 300) {
                const error = new HTTPError(response.status);
                if (retryAfterSeconds) {
                    error.retryAfterSeconds = retryAfterSeconds;
                }
                throw error;
            }

            const requestID = response.headers.get('X-Trace-ID') || '';
            const data = await response.json();

            return {
                success: data.success,
                code: data.code,
                origin: data.origin,
                timestamp: data.timestamp,
                requestID: requestID
            };
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeoutMs}ms`);
            }
            throw error;
        }
    }

    /**
     * Verify CAPTCHA solution obtained from the client-side
     * @param {VerifyInput} input - Verification input
     * @returns {Promise<VerifyOutput>} - Verification result
     */
    async verify(input) {
        if (!input.solution || input.solution.length === 0) {
            throw new SolutionError('privatecaptcha: solution is empty');
        }

        let attempts = 5;
        if (input.attempts > 0) {
            attempts = input.attempts;
        }

        let maxBackoffSeconds = 10;
        if (input.maxBackoffSeconds > 0) {
            maxBackoffSeconds = input.maxBackoffSeconds;
        }

        this._log('About to start verifying solution', {
            maxAttempts: attempts,
            maxBackoff: maxBackoffSeconds,
            solutionLength: input.solution.length
        });

        let currentDelay = 250; // Start with 250ms
        let lastError;

        for (let attempt = 0; attempt < attempts; attempt++) {
            if (attempt > 0) {
                let waitTime = currentDelay;

                if ((lastError instanceof HTTPError) && (lastError.statusCode === 429) && lastError.retryAfterSeconds) {
                    const retryAfterMs = Math.min(lastError.retryAfterSeconds, maxBackoffSeconds) * 1000;
                    if (retryAfterMs > currentDelay) {
                        waitTime = retryAfterMs;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, waitTime));

                currentDelay = Math.min(currentDelay * 2, maxBackoffSeconds * 1000);
            }

            try {
                const result = await this._doVerify(input.solution);
                this._log('Finished verifying solution', { attempts: attempt + 1, success: true });
                return result;
            } catch (error) {
                lastError = error;

                this._log('Failed to send verify request', {
                    attempt: attempt + 1,
                    error: error.message,
                    backoff: currentDelay,
                });

                let shouldRetry = true;
                if (error instanceof HTTPError) {
                    const status = error.statusCode;
                    shouldRetry = retriableStatusCodes.includes(status);
                }

                if (!shouldRetry) {
                    break;
                }
            }
        }

        this._log('Finished verifying solution', { attempts: attempts, success: false });

        throw new VerificationError(
            `Verification failed after ${attempts} attempts: ${lastError.message}`,
            lastError,
            attempts
        );
    }

    /**
     * Verifies captcha solution from Express request object
     * @param {Object} req - Express request object
     * @returns {Promise<VerifyOutput>} - Verification result
     */
    async verifyRequest(req) {
        let solution;

        if (req.body && req.body[this.formField]) {
            solution = req.body[this.formField];
        } else {
            throw new SolutionError(`Captcha solution not found in field '${this.formField}'. Ensure body parsing middleware is configured.`);
        }

        return await this.verify({ solution });
    }

    /**
     * Returns Express.js middleware function for automatic captcha verification
     * @returns {Function} - Express middleware function
     */
    middleware() {
        return async (req, res, next) => {
            try {
                const output = await this.verifyRequest(req);

                if (!output.success) {
                    return res.status(this.failedStatusCode).send(`Captcha verification failed: ${verifyCodeToString(output.code)}`);
                }

                next();
            } catch (error) {
                res.status(this.failedStatusCode).send(`Captcha verification error: ${error.message}`);
            }
        };
    }
}

/**
 * Creates a new Private Captcha client
 * @param {Configuration} config - Configuration object
 * @returns {Client} - New client instance
 */
export function createClient(config) {
    return new Client(config);
}
