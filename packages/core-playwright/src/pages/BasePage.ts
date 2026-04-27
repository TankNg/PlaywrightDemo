import type { Locator, Page } from '@playwright/test';

import { BaseElement } from '../elements/index.js';
import { Button } from '../elements/Button.js';
import { Checkbox } from '../elements/Checkbox.js';
import { Label } from '../elements/Label.js';
import { Textbox } from '../elements/Textbox.js';
import type { SelectorInput } from '../elements/selector.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('core.page');

export abstract class BasePage {
  protected readonly page: Page;

  /**
   * Creates a page object with a Playwright page instance.
   */
  protected constructor(page: Page) {
    this.page = page;
  }

  /**
   * Returns a raw Playwright locator.
   */
  protected locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  /**
   * Creates a generic element wrapper.
   */
  protected element(selector: SelectorInput, index?: number): BaseElement {
    return new BaseElement(this.page, selector, index);
  }

  /**
   * Creates a textbox element wrapper.
   */
  protected textbox(selector: SelectorInput, index?: number): Textbox {
    return new Textbox(this.page, selector, index);
  }

  /**
   * Creates a button element wrapper.
   */
  protected button(selector: SelectorInput, index?: number): Button {
    return new Button(this.page, selector, index);
  }

  /**
   * Creates a checkbox element wrapper.
   */
  protected checkbox(selector: SelectorInput, index?: number): Checkbox {
    return new Checkbox(this.page, selector, index);
  }

  /**
   * Creates a label element wrapper.
   */
  protected label(selector: SelectorInput, index?: number): Label {
    return new Label(this.page, selector, index);
  }

  /**
   * Navigates to the given relative path.
   */
  async navigate(path = ''): Promise<void> {
    logger.info(`Navigating to path: ${path || '/'}`);
    await this.page.goto(path);
  }
}
