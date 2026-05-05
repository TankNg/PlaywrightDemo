import { expect, test } from '@playwright/test';
import {
  getCredentials,
  formatTaggedTestName,
  loadJson,
  loadEnvironmentConfigFromJson,
  resolveFromModule,
  Environment, getEnvironment,
} from '@core-playwright/core';
import { LoginPage } from '../src/pages/LoginPage.js';
import type { LoginTestData } from '../src/types/login.types.js';

loadEnvironmentConfigFromJson({
  metaUrl: import.meta.url,
  configRelativePath: '../data/environment.json',
});
const loginDataPath = resolveFromModule(
  import.meta.url,
  '../data/login-data.json',
);
const loginData = loadJson<LoginTestData[]>(loginDataPath);
const env: Environment = getEnvironment()

test.describe('Login tests', () => {
  loginData.forEach((data) => {
    test(formatTaggedTestName(data.name, data.tags), async ({ page }) => {
      const loginPage = new LoginPage(page);
      const credentials = getCredentials(import.meta.url, data.id);
      const username = credentials.getUsername();
      let password = credentials.getPassword();
      await loginPage.goto(env.loginUrl);
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
