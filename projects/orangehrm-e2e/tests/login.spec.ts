import { expect, test } from '@playwright/test';
import {
  decryptValueFromEnv,
  loadJson,
  resolveFromModule,
} from '@core-playwright/core';
import { LoginPage } from '../src/pages/LoginPage.js';
import type { LoginTestData } from '../src/types/login.types.js';

const loginDataPath = resolveFromModule(import.meta.url, '../data/login-data.json');
const loginData = loadJson<LoginTestData[]>(loginDataPath);

function resolvePassword(data: LoginTestData): string {
  if (typeof data.encryptedPassword === 'string') {
    return decryptValueFromEnv(data.encryptedPassword);
  }

  return '';
}

test.describe('Login tests', () => {
  loginData.forEach((data) => {
    test(data.name, async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.login(data.username, resolvePassword(data));

      if (data.expected.type === 'error') {
        const errors = await loginPage.getErrors();
        expect(errors).toEqual(data.expected.messages);
        return;
      }

      await expect(page).toHaveURL(new RegExp(data.expected.urlContains));
    });
  });
});
