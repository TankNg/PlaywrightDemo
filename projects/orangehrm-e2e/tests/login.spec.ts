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
  if (typeof data.password === 'string') {
    return data.password;
  }

  if (typeof data.encryptedPassword === 'string') {
    return decryptValueFromEnv(data.encryptedPassword);
  }

  throw new Error(`Missing password for test case "${data.name}".`);
}

test.describe('Login tests', () => {
  loginData.forEach((data) => {
    test(data.name, async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.login(data.username, resolvePassword(data));

      if (data.expected.type === 'error') {
        await expect(loginPage.errorMessages.locator()).toHaveCount(
          data.expected.messages.length,
        );
        await expect.soft(loginPage.errorMessages.first().locator()).toBeVisible();

        const errors = await loginPage.getErrors();
        expect(errors).toEqual(data.expected.messages);
        return;
      }

      await expect(page).toHaveURL(new RegExp(data.expected.urlContains));
    });
  });
});
