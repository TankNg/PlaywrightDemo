import { expect, test } from '@playwright/test';
import { loadJson, resolveFromModule } from '@core-playwright/core';
import { LoginPage } from '../src/pages/LoginPage.js';
import type { LoginTestData } from '../src/types/login.types.js';

const loginDataPath = resolveFromModule(import.meta.url, '../data/login-data.json');
const loginData = loadJson<LoginTestData[]>(loginDataPath);

test.describe('Login tests', () => {
  loginData.forEach((data) => {
    test(data.name, async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.login(data.username, data.password);

      if (data.expected.type === 'error') {
        await expect(loginPage.errorMessages).toHaveCount(data.expected.messages.length);
        await expect.soft(loginPage.errorMessages.first()).toBeVisible();

        const errors = await loginPage.getErrors();
        expect(errors).toEqual(data.expected.messages);
        return;
      }

      await expect(page).toHaveURL(new RegExp(data.expected.urlContains));
    });
  });
});
