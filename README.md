# Playwright Workspace Design

This repository is organized as a small monorepo so `CorePlaywright` can be reused by multiple Playwright projects the same way a shared Maven module is reused by multiple Java modules.

## Structure

```text
packages/
  core-playwright/        Shared pages, config helpers, utilities
projects/
  orangehrm-e2e/         Example consumer project
```

## How reuse works

- `packages/core-playwright` is published internally as `@core-playwright/core`
- each subproject declares `"@core-playwright/core": "file:../../packages/core-playwright"` in `package.json`
- the `file:` dependency makes npm link the local core package into each project, similar to a Maven multi-module dependency

## Commands

```bash
npm install
npm run build
npm run typecheck
npm run test:orangehrm
npm run test:all
```

## Encrypted secrets

- store test passwords in JSON as `encryptedPassword`
- the runtime key comes from the `SECRET_KEY` environment variable
- keep the real key outside git, for example in a local `.env` file or CI secret
- `.env.demo` is only a template; generate your own key and re-encrypt secrets before committing real test credentials
- new encrypted values are stored as `iv:authTag:cipherText`
- the framework still accepts older `enc:v1:...` values during migration
- generate a brand new key:

```bash
npm run generate:key
```

- example output:

```bash
SECRET_KEY=your-generated-key
```

- encrypt plaintext with the key from `process.env.SECRET_KEY`:

```bash
npm run encrypt:secret -- "admin123"
```

- decrypt an encrypted value with the key from `process.env.SECRET_KEY`:

```bash
npm run decrypt:secret -- "iv:authTag:cipherText"
```

- set `SECRET_KEY=...` in the machine environment before running encrypt or decrypt commands
- if `SECRET_KEY` is missing, the encrypt and decrypt scripts exit immediately with an error
- copy the encrypted output into your JSON data as `encryptedPassword`
- after generating new encrypted values, replace the committed sample values in your JSON data

## Add a new subproject

1. Create a new folder under `projects/<your-project>`
2. Add a `package.json` with `"@core-playwright/core": "file:../../packages/core-playwright"`
3. Add `playwright.config.ts` and call `createPlaywrightConfig(...)`
4. Import shared utilities/pages from `@core-playwright/core`

Example:

```ts
import { createPlaywrightConfig, BasePage, loadJson } from '@core-playwright/core';
```
