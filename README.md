# private-captcha-js

[![NPM Version badge](https://img.shields.io/npm/v/%40private-captcha/private-captcha-js)](https://www.npmjs.com/package/@private-captcha/private-captcha-js) ![CI](https://github.com/PrivateCaptcha/private-captcha-js/actions/workflows/ci.yaml/badge.svg)

JavaScript client for server-side Private Captcha verification.

<mark>Please check the [official documentation](https://docs.privatecaptcha.com/docs/integrations/javascript/) for the in-depth and up-to-date information.</mark>

## Quick Start

- Install `private-captcha-js` npm package
    ```bash
    npm install private-captcha-js
    ```
- Instantiate the client and use `verify()` method    
    ```javascript
    import { createClient } from 'private-captcha-js';
    
    const client = createClient({ apiKey: 'your-api-key' });
    
    const result = await client.verify({ solution: 'captcha-solution-from-client' });
    if (result.ok()) {
        console.log('Captcha verified!');
    }
    ```
- Use Express.js middleware using `client.middleware()` method

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues with this Javascript client, please open an issue on GitHub.

For Private Captcha service questions, visit [privatecaptcha.com](https://privatecaptcha.com).
