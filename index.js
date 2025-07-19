import { backOff } from 'exponential-backoff';

/**
 * HTTP Error with status code
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
    return [0, false];
}

// Constants
export const GlobalDomain = 'api.privatecaptcha.com';
export const EUDomain = 'api.eu.privatecaptcha.com';
export const DefaultFormField = 'private-captcha-solution';

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
    }

    /**
     * Internal method to perform verification request
     * @private
     * @param {string} solution - The captcha solution
     * @returns {Promise<VerifyOutput>} - Verification result
     */
    async _doVerify(solution) {
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'X-Api-Key': this.apiKey,
                'Content-Type': 'text/plain'
            },
            body: solution
        });

        // Throw HTTPError for all non-2xx status codes
        if (response.status >= 300) {
            throw new HTTPError(response.status);
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
    }

    /**
     * Verify CAPTCHA solution obtained from the client-side
     * @param {VerifyInput} input - Verification input
     * @returns {Promise<VerifyOutput>} - Verification result
     */
    async verify(input) {
        let attempts = 5
        if (input.attempts > 0) {
            attempts = input.attempts
        }

        let maxBackoffSeconds = 4;
        if (input.maxBackoffSeconds > 0) {
            maxBackoffSeconds = input.maxBackoffSeconds;
        }

        return await backOff(
            () => this._doVerify(input.solution),
            {
                numOfAttempts: attempts,
                maxDelay: maxBackoffSeconds * 1000,
                startingDelay: 200,
                timeMultiple: 2,
                jitter: 'full',
                retry: (error) => {
                    // Retry on network errors or specific HTTP status codes
                    if (error instanceof HTTPError) {
                        const status = error.statusCode;
                        return status >= 500 || status === 408 || status === 425 || status === 429;
                    }
                    return true; // Retry on network errors
                }
            }
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
            throw new Error(`Captcha solution not found in field '${this.formField}'. Ensure body parsing middleware is configured.`);
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
