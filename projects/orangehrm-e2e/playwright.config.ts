import { createPlaywrightConfig, loadEnvironmentConfigFromJson } from '@core-playwright/core';

loadEnvironmentConfigFromJson({
  metaUrl: import.meta.url,
  configRelativePath: './data/environment.json',
});

export default createPlaywrightConfig({
  testDir: './tests',
  baseURL: process.env.LOGIN_URL ?? process.env.BASE_URL,
});
