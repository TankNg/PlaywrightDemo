import { Credential, type BeanContext, loadBeanContext } from '@core-playwright/core';
import { expect, test } from '@playwright/test';

let beanContext: BeanContext;

test.beforeAll(() => {
  beanContext = loadBeanContext(import.meta.url, {
    xmlPath: 'config/Setting.xml',
    propertiesPaths: [
      'config/Environment.properties',
      'config/QATCredential.properties',
    ],
  });
});

test('Bean context is preloaded for the suite', async () => {
  const environment = beanContext.getEnvironment();
  const credential = beanContext.getCredential('qatUser1') as Credential;
  const expectedUsername =
    process.env['target.cred'] === 'QAT1' ? 'wrong' : 'Admin';

  expect(beanContext.env).toBe(process.env.env ?? 'qat');
  expect(environment.loginUrl).toContain('orangehrmlive.com');
  expect(credential.username).toBe(expectedUsername);
});
