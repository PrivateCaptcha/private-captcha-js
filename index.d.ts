/**
 * Gets the HTTP status code from an error if it's an HTTPError
 * @param {Error} error - The error to check
 * @returns {[number, boolean]} - Tuple of [statusCode, isHTTPError]
 */
export function getStatusCode(error: Error): [number, boolean];
/**
 * Gets string representation of verify code
 * @param {number} code - The verify code
 * @returns {string} - String representation
 */
export function verifyCodeToString(code: number): string;
/**
 * Creates a new Private Captcha client
 * @param {Configuration} config - Configuration object
 * @returns {Client} - New client instance
 */
export function createClient(config: Configuration): Client;
/**
 * HTTP Error with status code
 * @property {number} statusCode - HTTP status code
 * @property {number|null} retryAfterSeconds - Retry-After header value in seconds
 */
export class HTTPError extends Error {
    /**
     * @param {number} statusCode - HTTP status code
     * @param {string} [message] - Error message
     * @param {string} [traceID=''] - Server-side request ID
     */
    constructor(statusCode: number, message?: string, traceID?: string);
    statusCode: number;
    retryAfterSeconds: any;
    traceID: string;
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
     * @param {string} [traceID=''] - Server-side request ID
     */
    constructor(message: string, originalError: Error, attempt?: number, traceID?: string);
    originalError: Error;
    attempt: number;
    traceID: string;
}
/**
 * Solution Error for missing or empty solutions/form fields
 */
export class SolutionError extends Error {
    /**
     * @param {string} message - Error message
     */
    constructor(message: string);
}
export const GlobalDomain: "api.privatecaptcha.com";
export const EUDomain: "api.eu.privatecaptcha.com";
export const DefaultFormField: "private-captcha-solution";
export namespace VerifyCode {
    let VerifyNoError: number;
    let VerifyErrorOther: number;
    let DuplicateSolutionsError: number;
    let InvalidSolutionError: number;
    let ParseResponseError: number;
    let PuzzleExpiredError: number;
    let InvalidPropertyError: number;
    let WrongOwnerError: number;
    let VerifiedBeforeError: number;
    let MaintenanceModeError: number;
    let TestPropertyError: number;
    let IntegrityError: number;
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
 * @property {string} traceID - Request ID for tracing
 */
/**
 * Private Captcha API Client
 */
export class Client {
    /**
     * @param {Configuration} config - Configuration object
     */
    constructor(config: Configuration);
    endpoint: string;
    apiKey: string;
    formField: string;
    failedStatusCode: number;
    timeoutMs: number;
    logger: Function;
    /**
     * Log debug message if logger is configured
     * @private
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    private _log;
    /**
     * Internal method to perform verification request
     * @private
     * @param {string} solution - The captcha solution
     * @returns {Promise<VerifyOutput>} - Verification result
     */
    private _doVerify;
    /**
     * Verify CAPTCHA solution obtained from the client-side
     * @param {VerifyInput} input - Verification input
     * @returns {Promise<VerifyOutput>} - Verification result
     */
    verify(input: VerifyInput): Promise<VerifyOutput>;
    /**
     * Verifies captcha solution from Express request object
     * @param {Object} req - Express request object
     * @returns {Promise<VerifyOutput>} - Verification result
     */
    verifyRequest(req: any): Promise<VerifyOutput>;
    /**
     * Returns Express.js middleware function for automatic captcha verification
     * @returns {Function} - Express middleware function
     */
    middleware(): Function;
}
export type Configuration = {
    /**
     * - Domain name when used with self-hosted version
     */
    domain?: string;
    /**
     * - API key created in Private Captcha account settings
     */
    apiKey: string;
    /**
     * - Custom form field to read puzzle solution from
     */
    formField?: string;
    /**
     * - HTTP status to return for failed verifications
     */
    failedStatusCode?: number;
    /**
     * - Debug logger function (e.g., console.debug)
     */
    logger?: Function;
    /**
     * - Request timeout in milliseconds
     */
    timeoutMs?: number;
};
export type VerifyInput = {
    /**
     * - The captcha solution
     */
    solution: string;
    /**
     * - Maximum backoff time in seconds
     */
    maxBackoffSeconds?: number;
    /**
     * - Number of retry attempts
     */
    attempts?: number;
};
export type VerifyOutput = {
    /**
     * - Whether verification succeeded
     */
    success: boolean;
    /**
     * - Verification result code
     */
    code: number;
    /**
     * - Origin of the request
     */
    origin?: string;
    /**
     * - Timestamp of verification
     */
    timestamp?: string;
    /**
     * - Request ID for tracing
     */
    traceID: string;
};
