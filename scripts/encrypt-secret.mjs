import { encryptValue } from '@core-playwright/core';

const value = process.argv[2];
const key = process.env.SECRET_KEY;

if (!value) {
  console.error('Usage: SECRET_KEY=your-key npm run encrypt:secret -- "your-plaintext"');
  process.exit(1);
}

if (!key) {
  console.error('Missing SECRET_KEY environment variable.');
  process.exit(1);
}

console.log(encryptValue(value, key));
