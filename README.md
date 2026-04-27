# Playwright Workspace Design

This repository is organized as a small monorepo so `CorePlaywright` can be reused by multiple Playwright projects the same way a shared Maven module is reused by multiple Java modules.

## Structure

```text
packages/
  core-playwright/        Shared pages, config helpers, utilities
projects/
  orangehrm-e2e/         Example consumer project
```

## Project structure details

### Core package (`packages/core-playwright`)

- `src/api`: shared API fixture and `ApiClient` helpers for API assertions
- `src/config`: reusable Playwright config builder for all projects
- `src/elements`: common element wrappers (`Button`, `Textbox`, `Checkbox`, etc.)
- `src/pages`: base page abstraction (`BasePage`) used by project page objects
- `src/types`: shared framework type contracts for API, elements, and reusable helpers
- `src/utils`: shared utilities (paths, test tags, crypto, logger, data loader)
- `src/index.ts`: public exports used by consumer projects

### Consumer project (`projects/orangehrm-e2e`)

- `src/pages`: project-specific Page Object Model classes (for example `LoginPage`)
- `src/types`: project domain types used by pages, test payloads, fixtures, and data models
- `src/utils`: project-only helper functions used by that project (mapping, formatters, builders, custom assertions, etc.)
- `tests`: Playwright test specs (`*.spec.ts`) that use page objects and fixtures
- `playwright.config.ts`: project-level config that calls `createPlaywrightConfig(...)`

### Recommended flow (`src/pages` + `tests`)

1. Put selectors and UI actions in page classes under `src/pages`
2. Keep test specs in `tests` focused on scenarios and assertions
3. Reuse shared wrappers from `@core-playwright/core` instead of raw locator logic in tests
4. Keep project type definitions close to usage in `src/types`
5. Place helper code that is not reusable across projects in project-local `src/utils`
6. If a utility becomes reusable across projects, move it into `packages/core-playwright/src/utils`

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

## Test execution config

- each Playwright project loads its own env file
- set `envDir` in that project's `playwright.config.ts`
- the framework reads `TEST_ENV` and loads `.env.<value>` from that project directory
- if `TEST_ENV` is not set, the default is `qat`
- example files for a project are `projects/orangehrm-e2e/.env.qat`, `.env.stg`, and `.env.prod`
- `PW_PARALLEL=false` runs with a single worker by default; set `true` to allow parallel execution
- `PW_RUN_MODE=headless` is the default; set `headed` to open the browser UI
- `PW_BROWSERS=chromium` is the default; provide a comma-separated list such as `chromium,firefox`
- `PW_GROUPS=` is optional; provide a comma-separated list such as `smoke` or `smoke,regression`
- group membership is declared per test with tags, which are appended to the Playwright test title as `@smoke`, `@regression`, and so on

Example:

```bash
TEST_ENV=qat npm run test:orangehrm
TEST_ENV=stg npm run test:orangehrm
TEST_ENV=prod PW_BROWSERS=chromium,firefox npm run test:orangehrm
```

Project config example:

```ts
import { createPlaywrightConfig, resolveFromModule } from '@core-playwright/core';

export default createPlaywrightConfig({
  envDir: resolveFromModule(import.meta.url, '.'),
  testDir: './tests',
  baseURL: 'https://opensource-demo.orangehrmlive.com',
});
```

Project env example:

```bash
PW_PARALLEL=false
PW_RUN_MODE=headless
PW_BROWSERS=chromium
PW_GROUPS=smoke
```

## Encrypted secrets

- store test passwords in JSON as `encryptedPassword`
- the runtime key comes from the `SECRET_KEY` environment variable
- keep the real key outside git and manage it separately from the Playwright runtime `.env` file, for example as a machine-level environment variable or CI secret
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

## API test support

- `@core-playwright/core` now includes a reusable `ApiClient`
- use `createApiTest()` to get an `api` fixture backed by Playwright's request context
- set `API_BASE_URL` in the project env file when API and UI targets differ
- if `API_BASE_URL` is missing, the API fixture falls back to `BASE_URL`

Example:

```ts
import { expect } from '@playwright/test';
import {
  createApiTest,
  type ApiSchemaExpectation,
  type ApiErrorResponse,
} from '@core-playwright/core';

const test = createApiTest();

type HealthResponse = {
  status: string;
  version: string;
};

test('health check', async ({ api }) => {
  const response = await api.get('/health');
  const schema: ApiSchemaExpectation<HealthResponse> = {
    requiredKeys: ['status', 'version'],
  };
  const body = await api.extractAndVerify<HealthResponse>(response, {
    status: 200,
    schema,
  });

  expect(body.status).toBe('ok');
});

test('invalid request', async ({ api }) => {
  const response = await api.get('/users/unknown');

  const error: ApiErrorResponse = await api.expectError(response, {
    status: 404,
    code: 'USER_NOT_FOUND',
    message: 'User not found',
  });

  expect(error.code).toBe('USER_NOT_FOUND');
});
```

## Add a new subproject

1. Create a new folder under `projects/<your-project>`
2. Add a `package.json` with `"@core-playwright/core": "file:../../packages/core-playwright"`
3. Add `playwright.config.ts` and call `createPlaywrightConfig(...)`
4. Import shared utilities/pages from `@core-playwright/core`

Example:

```ts
import { createPlaywrightConfig, BasePage, loadJson } from '@core-playwright/core';
```
