import { decryptValue } from '@core-playwright/core';

const value = process.argv[2];
const key = process.env.SECRET_KEY;

if (!value) {
  console.error('Usage: SECRET_KEY=your-key npm run decrypt:secret -- "your-encrypted-value"');
  process.exit(1);
}

if (!key) {
  console.error('Missing SECRET_KEY environment variable.');
  process.exit(1);
}

console.log(decryptValue(value, key));
