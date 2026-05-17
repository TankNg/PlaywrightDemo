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
