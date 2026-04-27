import type { Locator, Page } from '@playwright/test';

import { BaseElement } from './BaseElement.js';
import type { SelectorInput } from './selector.js';

export class Checkbox extends BaseElement {
  /**
   * Creates a checkbox element wrapper.
   */
  constructor(scope: Page | Locator, selector: SelectorInput, index?: number) {
    super(scope, selector, index);
  }

  /**
   * Checks the checkbox after it becomes visible.
   */
  async check(): Promise<void> {
    await this.waitForVisible();
    await this.locator().check();
  }

  /**
   * Unchecks the checkbox after it becomes visible.
   */
  async uncheck(): Promise<void> {
    await this.waitForVisible();
    await this.locator().uncheck();
  }

  /**
   * Returns whether the checkbox is currently checked.
   */
  async isChecked(): Promise<boolean> {
    await this.waitForVisible();
    return this.locator().isChecked();
  }
}
