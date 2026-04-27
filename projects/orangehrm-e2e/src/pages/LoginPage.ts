import type { Page } from '@playwright/test';
import { BasePage, Button, Label, Textbox } from '@core-playwright/core';

export class LoginPage extends BasePage {
  readonly username: Textbox;
  readonly password: Textbox;
  readonly loginButton: Button;
  readonly errorMessages: Label;

  constructor(page: Page) {
    super(page);
    this.username = this.textbox('input[name="username"]');
    this.password = this.textbox('input[name="password"]');
    this.loginButton = this.button('button[type="submit"]');
    this.errorMessages = this.label(
      '.oxd-alert-content-text, .oxd-input-field-error-message',
    );
  }

  async goto(): Promise<void> {
    await this.navigate('/');
  }

  async login(user: string, pass: string): Promise<void> {
    await this.username.enterText(user);
    await this.password.enterText(pass);
    await this.loginButton.click();
  }

  async getErrors(): Promise<string[]> {
    return this.errorMessages.getTexts();
  }
}
