# Playwright Framework Workspace

This repository is a small Playwright monorepo built around a shared core package and a sample end-to-end project.

It is intended for teams that want:

- shared Playwright setup across multiple projects
- reusable page and element abstractions
- a place to keep common test utilities in one package
- project-specific tests and page objects isolated from the shared framework

## What is in this project

The workspace currently contains two main parts:

```text
packages/
  core-playwright/        Shared Playwright framework package
projects/
  orangehrm-e2e/          Example consumer project for OrangeHRM
scripts/                  Secret generation and encryption helpers
```

### `packages/core-playwright`

This package exposes the reusable framework pieces:

- `src/config`: shared Playwright config builder
- `src/pages`: base page abstraction
- `src/elements`: wrapper classes like `Textbox`, `Button`, `Checkbox`, `Label`
- `src/api`: reusable API fixture and API client helpers
- `src/utils`: shared helpers such as bean loading, property loading, paths, logger, crypto, and test tags
- `src/index.ts`: public exports for consumer projects

### `projects/orangehrm-e2e`

This is the example project that consumes `@core-playwright/core`:

- `playwright.config.ts`: project-level Playwright config
- `src/pages`: project-specific page objects such as `LoginPage`
- `src/types`: project types
- `tests`: Playwright test specs
- `config`: XML and properties files used by the bean loader
- `data`: test data JSON files

## How the workspace is organized

This repo uses npm workspaces:

- root `package.json` manages shared dependencies and workspace scripts
- `packages/core-playwright` is linked into projects through a local `file:` dependency
- each project can keep its own tests and config while reusing the core package

That gives you a setup similar to a shared automation library consumed by multiple test suites.

## Requirements

- Node.js 18 or newer
- npm 9 or newer

Playwright browsers are also required. They can be installed with the Playwright CLI after dependencies are installed.

## Install

Clone the repository, then install dependencies from the root:

```bash
npm install
```

This installs the packages used by the workspace, including:

- `@playwright/test`
- `typescript`
- `@types/node`
- `cross-env`
- `prettier`
- `properties-reader`
- `xmldom`
- `xpath`
- `log4js`

Install Playwright browsers:

```bash
npx playwright install
```

If this is a fresh machine, these are the minimum setup commands:

```bash
npm install
npx playwright install
```

## Setup

### 1. Build or type-check the workspace

```bash
npm run build
```

or

```bash
npm run typecheck
```

### 2. Review the example project configuration

The sample project uses XML and `.properties` configuration files under:

```text
projects/orangehrm-e2e/config/
```

Current files include:

- `Environment.properties`
- `QATCredential.properties`
- `Setting.xml`
- `QATCredential.xml`

The example test reads beans from these files through `getBeanById(...)`.

### 3. Optional runtime environment variables

The shared config builder reads these variables at runtime:

- `PW_PARALLEL=true|false`
- `PW_RUN_MODE=headless|headed`
- `PW_BROWSERS=chromium,firefox,webkit`
- `PW_GROUPS=smoke,regression`
- `CI=true`

Defaults:

- runs with `chromium`
- runs `headless`
- uses `1` worker unless `PW_PARALLEL=true`

Example:

```bash
PW_RUN_MODE=headed PW_BROWSERS=chromium npm run test:orangehrm
```

## How to use

### Run the sample project

From the repository root:

```bash
npm run test:orangehrm
```

Run all workspace tests:

```bash
npm run test:all
```

Run the sample project in headed mode:

```bash
npm run test:orangehrm:headed
```

### Write tests in the example project

Tests live here:

```text
projects/orangehrm-e2e/tests/
```

The current example test:

- loads a bean using `getBeanById(...)`
- resolves values from XML and `.properties`
- prints the resolved username

### Create page objects

Project page objects should live under:

```text
projects/orangehrm-e2e/src/pages/
```

The existing `LoginPage` shows the intended pattern:

- extend `BasePage`
- build controls with shared wrappers like `textbox(...)` and `button(...)`
- keep selector logic and UI actions inside the page object

### Reuse the shared framework

Import shared utilities from:

```ts
import { BasePage, Button, Textbox, createPlaywrightConfig } from '@core-playwright/core';
```

Useful shared capabilities already present in the core package:

- Playwright config creation with browser and mode selection from environment variables
- page object base class
- element wrappers for common controls
- API test fixture with `createApiTest()`
- XML and `.properties` bean loading
- encryption helpers for secrets

### Use `cross-env` to switch environment or credential files

This workspace already includes `cross-env` as a dependency.

Use it when you need to set environment variables in a way that works on macOS, Linux, and Windows.

This is especially useful here because the XML import in `projects/orangehrm-e2e/config/Setting.xml` uses:

```xml
<import resource="{target.cred:QAT}Credential.xml" />
```

That means:

- if `target.cred` is not set, the loader imports `QATCredential.xml`
- if `target.cred=QAT1`, the loader imports `QAT1Credential.xml`

Example:

```bash
npx cross-env target.cred=QAT1 npm run test:orangehrm
```

Use this when you want to switch the credential XML source without changing the code.

### `env=qat` and `target.cred=QAT1`

These two values control different things:

- `env=qat`: a value you can use in your own test/config code to choose the environment bean id
- `target.cred=QAT1`: chooses which credential XML file gets imported automatically

With the current XML:

- `env=qat` maps to the bean `<bean id="qat" class="Environment">`
- `target.cred=QAT1` maps to `QAT1Credential.xml`

Example command:

```bash
npx cross-env env=qat target.cred=QAT1 npm run test:orangehrm
```

In practice:

- environment bean id to request: `qat`
- credential import file: `QAT1Credential.xml`

### How this is used in code

The recommended pattern is to create a project-level base test and let it preload the bean context once per worker.

The framework now provides `createBaseTest(...)` for that.

Example project base test:

```ts
import { createBaseTest, expect } from '@core-playwright/core';

export const test = createBaseTest({
  metaUrl: import.meta.url,
  xmlPath: 'config/Setting.xml',
  propertiesPaths: [
    'config/Environment.properties',
    'config/QATCredential.properties',
  ],
  defaultEnv: 'qat',
  debug: {
    env: 'qat',
    credTarget: 'QAT1',
  },
});

export { expect };
```

Then use that base test in specs:

```ts
import { expect, test } from './baseTest.js';

test('example', async ({ beanContext, environment, getCredential }) => {
  const credential = getCredential('qatUser1');

  expect(beanContext.env).toBe('qat');
  expect(environment.loginUrl).toContain('orangehrmlive.com');
  expect(credential.username).toBeTruthy();
});
```

Available fixtures from the base test:

- `beanContext`: full preloaded bean context
- `environment`: selected environment bean
- `getCredential(id)`: helper to resolve a credential bean by id

### Base test precedence

The base test resolves runtime selection in this order:

1. values passed from `cross-env`
2. debug defaults configured in the project `baseTest.ts`
3. `defaultEnv` for the environment bean id

That means `cross-env` always wins, and the local debug config is only a fallback.

### Preload beans through the base test

If you want Selenium-style shared setup, use the project base test instead of repeating `beforeAll(...)` in every spec.

Run with explicit runtime selection:

```bash
npx cross-env env=qat target.cred=QAT1 npm run test:orangehrm
```

Or run locally with only the debug defaults from `baseTest.ts`:

```bash
npm run test:orangehrm
```

With the current example:

- `env=qat` selects the `qat` environment bean
- `target.cred=QAT1` imports `QAT1Credential.xml`
- if `cross-env` values are missing, the project `baseTest.ts` debug values are used

## Add a new project

To add another Playwright project that reuses the shared core package:

### 1. Create a new project folder

Create a folder under:

```text
projects/<your-project>/
```

Suggested structure:

```text
projects/<your-project>/
  package.json
  playwright.config.ts
  tsconfig.json
  src/pages/
  src/types/
  tests/
  config/
  data/
```

### 2. Add a project `package.json`

Example:

```json
{
  "name": "@projects/your-project",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@core-playwright/core": "file:../../packages/core-playwright"
  },
  "scripts": {
    "test": "playwright test -c playwright.config.ts",
    "typecheck": "tsc -b --pretty false"
  }
}
```

### 3. Add a project TypeScript config

Create `projects/<your-project>/tsconfig.json` and extend the workspace base config using the same pattern as the existing project.

### 4. Add the project to `tsconfig.workspace.json`

Add a new reference entry so workspace build and type-check include the project.

Example:

```json
{
  "files": [],
  "references": [
    { "path": "./packages/core-playwright" },
    { "path": "./projects/orangehrm-e2e" },
    { "path": "./projects/your-project" }
  ]
}
```

### 5. Add a Playwright config

Create `projects/<your-project>/playwright.config.ts` and use the shared config builder:

```ts
import { createPlaywrightConfig } from '@core-playwright/core';

export default createPlaywrightConfig({
  testDir: './tests',
  baseURL: '',
});
```

### 6. Add page objects and tests

- put page objects in `src/pages`
- put test specs in `tests`
- import shared classes from `@core-playwright/core`

### 7. Run the new project

From the repo root, run it with Playwright config path directly:

```bash
npx playwright test -c projects/<your-project>/playwright.config.ts
```

If you want a root shortcut, add a new script in the root `package.json`.

## Available scripts

Root scripts:

```bash
npm run build
npm run typecheck
npm run test:orangehrm
npm run test:orangehrm:headed
npm run test:all
npm run generate:key
npm run encrypt:secret -- "your-plain-text"
npm run decrypt:secret -- "your-encrypted-value"
```

## Secret handling

The repo includes helper scripts for secret management:

- `npm run generate:key`
- `npm run encrypt:secret -- "value"`
- `npm run decrypt:secret -- "value"`

These scripts expect `SECRET_KEY` to be available in the environment for encryption and decryption.

Example:

```bash
export SECRET_KEY=your-generated-key
npm run encrypt:secret -- "admin123"
```

## Example workflow

1. Install dependencies with `npm install`
2. Install Playwright browsers with `npx playwright install`
3. Review or update files in `projects/orangehrm-e2e/config`
4. Run `npm run build` or `npm run typecheck`
5. Execute `npm run test:orangehrm`

## Notes

- The repository currently includes built output under `dist/` in workspace packages and projects.
- The sample project is still centered on XML and `.properties` configuration rather than JSON-based environment loading.
- `@core-playwright/core` is designed to be reused by additional projects under `projects/`.
