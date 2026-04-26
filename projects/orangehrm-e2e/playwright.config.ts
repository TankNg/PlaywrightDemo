import { createPlaywrightConfig } from '@core-playwright/core';

export default createPlaywrightConfig({
  testDir: './tests',
  baseURL: 'https://opensource-demo.orangehrmlive.com',
});
