import { expect, test } from '@playwright/test';
import {
  createCredentialStoreFromJson,
  formatTaggedTestName,
  loadJson,
  loadEnvironmentConfigFromJson,
  resolveFromModule,
} from '@core-playwright/core';
import { LoginPage } from '../src/pages/LoginPage.js';
import type { LoginTestData } from '../src/types/login.types.js';

loadEnvironmentConfigFromJson({
  metaUrl: import.meta.url,
  configRelativePath: '../data/environment.json',
});
const loginDataPath = resolveFromModule(import.meta.url, '../data/login-data.json');
const loginData = loadJson<LoginTestData[]>(loginDataPath);
const credentialStore = createCredentialStoreFromJson({
  metaUrl: import.meta.url,
  filePattern: '../data/credentials.{env}.json',
});

test.describe('Login tests', () => {
  loginData.forEach((data) => {
    test(formatTaggedTestName(data.name, data.tags), async ({ page }) => {
      const loginPage = new LoginPage(page);
      const username = data.username?.trim() ?? '';
      const credential = username
        ? credentialStore.get(username)
        : undefined;
      const password = credential?.getPassword() ?? '';

      await loginPage.goto();
      await loginPage.login(username, password);

      if (data.expected.type === 'error') {
        const errors = await loginPage.getErrors();
        expect(errors).toEqual(data.expected.messages);
        return;
      }

      await expect(page).toHaveURL(new RegExp(data.expected.urlContains));
    });
  });
});
