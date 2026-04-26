import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

export interface CorePlaywrightProjectOptions {
  testDir: string;
  baseURL?: string;
  fullyParallel?: boolean;
  retries?: number;
  workers?: number;
  reporter?: PlaywrightTestConfig['reporter'];
}

export function createPlaywrightConfig(
  options: CorePlaywrightProjectOptions,
): PlaywrightTestConfig {
  return defineConfig({
    testDir: options.testDir,
    fullyParallel: options.fullyParallel ?? false,
    forbidOnly: !!process.env.CI,
    retries: options.retries ?? (process.env.CI ? 2 : 0),
    workers: options.workers ?? (process.env.CI ? 1 : undefined),
    reporter: options.reporter ?? 'html',
    use: {
      baseURL: options.baseURL,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
  });
}
