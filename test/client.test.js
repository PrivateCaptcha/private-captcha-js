import { test } from 'node:test';
import assert from 'node:assert';
import { createClient, VerifyCode, VerificationError, DefaultFormField, SolutionError, HTTPError } from '../index.js';

const solutionsCount = 16;
const solutionLength = 8;

let cachedTestPuzzle = null;

async function fetchTestPuzzle() {
    if (cachedTestPuzzle !== null) {
        return cachedTestPuzzle;
    }

    const response = await fetch('https://api.privatecaptcha.com/puzzle?sitekey=aaaaaaaabbbbccccddddeeeeeeeeeeee', {
        headers: {
            'Origin': 'not.empty'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    cachedTestPuzzle = await response.text();
    return cachedTestPuzzle;
}

test('Stub puzzle test', async () => {
    const puzzle = await fetchTestPuzzle();

    const client = createClient({
        apiKey: process.env.PC_API_KEY || 'test-key',
        logger: console.debug
    });

    const emptySolutionsBytes = new Array(solutionsCount * solutionLength).fill(0);
    const solutionsStr = Buffer.from(emptySolutionsBytes).toString('base64');
    const payload = `${solutionsStr}.${puzzle}`;

    const output = await client.verify({ solution: payload });

    assert.strictEqual(output.success, true);
    assert.strictEqual(output.code, VerifyCode.TestPropertyError);
});

test('Verify error test', async () => {
    const puzzle = await fetchTestPuzzle();

    const client = createClient({
        apiKey: process.env.PC_API_KEY || 'test-key',
        logger: console.debug
    });

    const emptySolutionsBytes = new Array(solutionsCount * solutionLength / 2).fill(0);
    const solutionsStr = Buffer.from(emptySolutionsBytes).toString('base64');
    const payload = `${solutionsStr}.${puzzle}`;

    try {
        await client.verify({ solution: payload });
        assert.fail('Should have thrown an error for HTTP 400');
    } catch (error) {
        assert.ok(error instanceof HTTPError, 'Should be a HTTPError');
        assert.strictEqual(error.statusCode, 400, 'Should be Bad Request error');
    }
});

test('Retry backoff test', async () => {
    const client = createClient({
        apiKey: process.env.PC_API_KEY || 'test-key',
        domain: 'does-not-exist.qwerty12345-asdfjkl.net',
        timeoutMs: 1000, // 1 second timeout
        logger: console.debug
    });

    const input = {
        solution: 'asdf',
        maxBackoffSeconds: 1,
        attempts: 4
    };

    try {
        await client.verify(input);
        assert.fail('Should have thrown an error for invalid domain');
    } catch (error) {
        assert.ok(error instanceof VerificationError, 'Should be a VerificationError');
        assert.strictEqual(error.attempt, input.attempts, 'Should have made all attempts');
        assert.ok(error.originalError, 'Should have original error');
    }
});

test('Custom form field test', async () => {
    const puzzle = await fetchTestPuzzle();

    // Create proper payload like other tests
    const emptySolutionsBytes = new Array(solutionsCount * solutionLength).fill(0);
    const solutionsStr = Buffer.from(emptySolutionsBytes).toString('base64');
    const payload = `${solutionsStr}.${puzzle}`;

    const customField = 'my-custom-captcha-field';
    const client = createClient({
        apiKey: process.env.PC_API_KEY || 'test-key',
        formField: customField,
        logger: console.debug
    });

    // Test with custom field present
    const reqWithCustomField = {
        body: {
            [customField]: payload
        }
    };

    try {
        const output = await client.verifyRequest(reqWithCustomField);
        // Should succeed with test property error
        assert.strictEqual(output.success, true);
        assert.strictEqual(output.code, VerifyCode.TestPropertyError);
    } catch (error) {
        assert.fail('Should not have thrown an error when custom field is present');
    }

    // Test with custom field missing
    const reqWithoutCustomField = {
        body: {
            [DefaultFormField]: payload // default field, but we expect custom field
        }
    };

    try {
        await client.verifyRequest(reqWithoutCustomField);
        assert.fail('Should have thrown an error for missing custom field');
    } catch (error) {
        assert.ok(error instanceof SolutionError);
    }
});

test('Empty API key test', () => {
    // Test with empty string
    assert.throws(() => {
        createClient({ apiKey: '' });
    }, Error);

    // Test with null
    assert.throws(() => {
        createClient({ apiKey: null });
    }, Error);

    // Test with undefined
    assert.throws(() => {
        createClient({ apiKey: undefined });
    }, Error);

    // Test with missing apiKey property
    assert.throws(() => {
        createClient({});
    }, Error);
});
