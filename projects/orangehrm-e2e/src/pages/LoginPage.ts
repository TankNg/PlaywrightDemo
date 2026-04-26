import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@core-playwright/core';

export class LoginPage extends BasePage {
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly errorMessages: Locator;

  constructor(page: Page) {
    super(page);
    this.username = this.locator('input[name="username"]');
    this.password = this.locator('input[name="password"]');
    this.loginButton = this.locator('button[type="submit"]');
    this.errorMessages = this.locator(
      '.oxd-alert-content-text, .oxd-input-field-error-message',
    );
  }

  async goto(): Promise<void> {
    await this.navigate('/');
  }

  async login(user: string, pass: string): Promise<void> {
    await this.username.fill(user);
    await this.password.fill(pass);
    await this.loginButton.click();
  }

  async getErrors(): Promise<string[]> {
    if (!(await this.errorMessages.first().isVisible())) {
      return [];
    }

    const texts = await this.errorMessages.allTextContents();
    return texts.map((text) => text.trim()).filter(Boolean);
  }
}
