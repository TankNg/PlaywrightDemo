import path from 'node:path';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { getLogger } from '../utils/logger.js';

export interface CorePlaywrightProjectOptions {
  testDir: string;
  baseURL?: string;
  envDir?: string;
  fullyParallel?: boolean;
  retries?: number;
  workers?: number;
  reporter?: PlaywrightTestConfig['reporter'];
}

const SUPPORTED_BROWSERS = ['chromium', 'firefox', 'webkit'] as const;

type SupportedBrowser = (typeof SUPPORTED_BROWSERS)[number];
const logger = getLogger('core.config');

/**
 * Parses boolean-like environment values.
 */
function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value.trim().toLowerCase() === 'true';
}

/**
 * Splits a comma-separated string into trimmed items.
 */
function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Resolves valid browser names from environment input.
 */
function resolveBrowsers(value: string | undefined): SupportedBrowser[] {
  const browsers = parseCsv(value)
    .map((browser) => browser.toLowerCase())
    .filter((browser): browser is SupportedBrowser =>
      SUPPORTED_BROWSERS.includes(browser as SupportedBrowser),
    );

  return browsers.length > 0 ? browsers : ['chromium'];
}

/**
 * Resolves execution mode from environment input.
 */
function resolveRunMode(value: string | undefined): 'headless' | 'headed' {
  return value?.trim().toLowerCase() === 'headed' ? 'headed' : 'headless';
}

/**
 * Escapes a string for safe regex construction.
 */
function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a grep regex from configured test groups.
 */
function resolveGroupGrep(value: string | undefined): RegExp | undefined {
  const groups = parseCsv(value);
  if (groups.length === 0) {
    return undefined;
  }

  const pattern = groups.map((group) => `@${escapeForRegex(group)}`).join('|');
  return new RegExp(pattern);
}

/**
 * Builds a Playwright project config for a specific browser.
 */
function resolveProject(
  browserName: SupportedBrowser,
): NonNullable<PlaywrightTestConfig['projects']>[number] {
  const deviceByBrowser: Record<SupportedBrowser, keyof typeof devices> = {
    chromium: 'Desktop Chrome',
    firefox: 'Desktop Firefox',
    webkit: 'Desktop Safari',
  };

  return {
    name: browserName,
    use: {
      ...devices[deviceByBrowser[browserName]],
      browserName,
    },
  };
}

/**
 * Loads environment variables from an env file by TEST_ENV.
 */
function loadProjectEnv(envDir: string | undefined): void {
  const env = process.env.TEST_ENV || 'qat';
  const envFile = `.env.${env}`;
  const envPath = path.resolve(envDir ?? process.cwd(), envFile);
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    logger.warn(`Env file not found: ${envPath}`);
    return;
  }

  logger.info(`Running with env: ${env} (${envPath})`);
}

/**
 * Creates a shared Playwright configuration for framework projects.
 */
export function createPlaywrightConfig(
  options: CorePlaywrightProjectOptions,
): PlaywrightTestConfig {
  loadProjectEnv(options.envDir);

  const runInParallel = parseBoolean(process.env.PW_PARALLEL, false);
  const runMode = resolveRunMode(process.env.PW_RUN_MODE);
  const browsers = resolveBrowsers(process.env.PW_BROWSERS);
  const grep = resolveGroupGrep(process.env.PW_GROUPS);
  logger.debug(
    `Resolved playwright config: parallel=${runInParallel}, mode=${runMode}, browsers=${browsers.join(',')}`,
  );

  return defineConfig({
    testDir: options.testDir,
    fullyParallel: options.fullyParallel ?? runInParallel,
    forbidOnly: !!process.env.CI,
    retries: options.retries ?? (process.env.CI ? 2 : 0),
    workers: options.workers ?? (runInParallel ? undefined : 1),
    reporter: options.reporter ?? 'html',
    grep,
    use: {
      baseURL: options.baseURL,
      headless: runMode !== 'headed',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    projects: browsers.map(resolveProject),
  });
}
