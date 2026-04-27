import type { Page } from '@playwright/test';
import { BasePage, Button, getLogger, Label, Textbox } from '@core-playwright/core';

const logger = getLogger('orangehrm.page.login');

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
    logger.info('Opening login page');
    await this.navigate('/');
  }

  async login(user: string, pass: string): Promise<void> {
    logger.info(`Login with username: ${user}`);
    await this.username.enterText(user);
    await this.password.enterText(pass);
    await this.loginButton.click();
  }

  async getErrors(): Promise<string[]> {
    return this.errorMessages.getTexts();
  }
}
