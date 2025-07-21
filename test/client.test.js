import { test } from 'node:test';
import assert from 'node:assert';
import { createClient, VerifyCode } from '../index.js';

const solutionsCount = 16;
const solutionLength = 8;

async function fetchTestPuzzle() {
    const response = await fetch('https://api.privatecaptcha.com/puzzle?sitekey=aaaaaaaabbbbccccddddeeeeeeeeeeee', {
        headers: {
            'Origin': 'not.empty'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
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

    const output = await client.verify({ solution: payload });

    assert.strictEqual(output.success, false);
    assert.strictEqual(output.code, VerifyCode.ParseResponseError);
});

test('Retry backoff test', async () => {
    const client = createClient({
        apiKey: process.env.PC_API_KEY || 'test-key',
        domain: 'does-not-exist.qwerty12345-asdfjkl.net',
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
        assert.ok(error, 'Should have an error');
        assert.strictEqual(error.attempt, input.attempts, 'Should have made all attempts');
    }
});
