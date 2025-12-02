# private-captcha-js

[![NPM Version badge](https://img.shields.io/npm/v/%40private-captcha/private-captcha-js)](https://www.npmjs.com/package/@private-captcha/private-captcha-js) ![CI](https://github.com/PrivateCaptcha/private-captcha-js/actions/workflows/ci.yaml/badge.svg)

JavaScript client for server-side Private Captcha verification.

## Installation

```bash
npm install private-captcha-js
```

## Usage

### Basic Verification

```javascript
import { createClient } from 'private-captcha-js';

const client = createClient({ apiKey: 'your-api-key' });

const result = await client.verify({ solution: 'captcha-solution-from-client' });
if (result.ok()) {
    console.log('Captcha verified!');
}
```

### Express.js Middleware

```javascript
import express from 'express';
import { createClient } from 'private-captcha-js';

const app = express();
app.use(express.urlencoded({ extended: true })); // Required

const client = createClient({ apiKey: 'your-api-key' });

// Protect route with middleware
app.post('/submit', client.middleware(), (req, res) => {
    res.send('Form submitted successfully!');
});

// Or verify manually
app.post('/verify', async (req, res) => {
    try {
        const result = await client.verifyRequest(req);
        res.json({ success: result.success });
    } catch (error) {
        res.status(403).json({ error: error.message });
    }
});
```

## Configuration

```javascript
const client = createClient({
    apiKey: 'your-api-key',                 // Required
    formField: 'private-captcha-solution',  // Field from where to read the solution
    failedStatusCode: 403,                  // HTTP status code for failed verifications (middleware)
    domain: 'api.privatecaptcha.com'        // Override for EU isolation or for self-hosting
});
```

### Retry configuration

```javascript
client.verify({
    solution: 'solution',
    maxBackoffSeconds: 10,
    attempts: 10
});
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues with this Javascript client, please open an issue on GitHub.

For Private Captcha service questions, visit [privatecaptcha.com](https://privatecaptcha.com).
