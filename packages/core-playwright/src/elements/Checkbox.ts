import type { Locator, Page } from '@playwright/test';

import { BaseElement } from './BaseElement.js';
import type { SelectorInput } from './selector.js';

export class Checkbox extends BaseElement {
  constructor(scope: Page | Locator, selector: SelectorInput, index?: number) {
    super(scope, selector, index);
  }

  async check(): Promise<void> {
    await this.waitForVisible();
    await this.locator().check();
  }

  async uncheck(): Promise<void> {
    await this.waitForVisible();
    await this.locator().uncheck();
  }

  async isChecked(): Promise<boolean> {
    await this.waitForVisible();
    return this.locator().isChecked();
  }
}
