import { createPlaywrightConfig, resolveFromModule } from '@core-playwright/core';

export default createPlaywrightConfig({
  envDir: resolveFromModule(import.meta.url, '.'),
  testDir: './tests',
  baseURL: 'https://opensource-demo.orangehrmlive.com',
});
