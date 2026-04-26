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
npm run typecheck
npm run test:orangehrm
npm run test:all
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
