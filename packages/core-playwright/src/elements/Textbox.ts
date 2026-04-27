import type { Locator, Page } from '@playwright/test';

import { BaseElement } from './BaseElement.js';
import type { SelectorInput } from './selector.js';

export class Textbox extends BaseElement {
  /**
   * Creates a textbox element wrapper.
   */
  constructor(scope: Page | Locator, selector: SelectorInput, index?: number) {
    super(scope, selector, index);
  }

  /**
   * Enters text into the textbox.
   */
  async enterText(value: string): Promise<void> {
    await this.fill(value);
  }
}
