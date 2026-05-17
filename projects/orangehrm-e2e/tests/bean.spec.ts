import { expect, test } from './baseTest.js';

test('Bean context is preloaded in base test', async ({
  beanContext,
  environment,
  getCredential,
}) => {
  const credential = getCredential('qatUser1');
  const expectedUsername =
    (beanContext.variables['target.cred'] ?? 'QAT') === 'QAT1'
      ? 'wrong'
      : 'Admin';

  expect(beanContext.env).toBe(beanContext.variables['env'] ?? 'qat');
  expect(environment.loginUrl).toContain('orangehrmlive.com');
  expect(credential.username).toBe(expectedUsername);
});
