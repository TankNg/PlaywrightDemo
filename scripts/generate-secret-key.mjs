import { generateSecretKey } from '@core-playwright/core';

const secretKey = generateSecretKey();

console.log(`SECRET_KEY=${secretKey}`);
