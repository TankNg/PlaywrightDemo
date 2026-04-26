import type { Locator, Page } from '@playwright/test';

import { BaseElement } from '../elements/index.js';
import { Button } from '../elements/Button.js';
import { Checkbox } from '../elements/Checkbox.js';
import { Label } from '../elements/Label.js';
import { Textbox } from '../elements/Textbox.js';
import type { SelectorInput } from '../elements/selector.js';

export abstract class BasePage {
  protected readonly page: Page;

  protected constructor(page: Page) {
    this.page = page;
  }

  protected locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  protected element(selector: SelectorInput, index?: number): BaseElement {
    return new BaseElement(this.page, selector, index);
  }

  protected textbox(selector: SelectorInput, index?: number): Textbox {
    return new Textbox(this.page, selector, index);
  }

  protected button(selector: SelectorInput, index?: number): Button {
    return new Button(this.page, selector, index);
  }

  protected checkbox(selector: SelectorInput, index?: number): Checkbox {
    return new Checkbox(this.page, selector, index);
  }

  protected label(selector: SelectorInput, index?: number): Label {
    return new Label(this.page, selector, index);
  }

  async navigate(path = ''): Promise<void> {
    await this.page.goto(path);
  }
}
