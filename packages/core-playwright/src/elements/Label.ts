import type { Locator, Page } from '@playwright/test';

import { BaseElement } from './BaseElement.js';
import type { SelectorInput } from './selector.js';

export class Label extends BaseElement {
  /**
   * Creates a label element wrapper.
   */
  constructor(scope: Page | Locator, selector: SelectorInput, index?: number) {
    super(scope, selector, index);
  }
}
