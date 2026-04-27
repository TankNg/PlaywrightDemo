import type { Locator, Page } from '@playwright/test';

import {
  normalizeSelector,
  toPlaywrightSelector,
  type SelectorDefinition,
  type SelectorInput,
} from './selector.js';

type SearchScope = Page | Locator;

export interface FindElementOptions {
  index?: number;
}

export class BaseElement {
  private readonly scope: SearchScope;
  private readonly selector: SelectorDefinition;
  private readonly index?: number;

  /**
   * Creates an element wrapper inside the provided search scope.
   */
  constructor(scope: SearchScope, selector: SelectorInput, index?: number) {
    this.scope = scope;
    this.selector = normalizeSelector(selector);
    this.index = index;
  }

  /**
   * Resolves the final locator, including optional index access.
   */
  private get resolvedLocator(): Locator {
    const locator = this.scope.locator(toPlaywrightSelector(this.selector));
    return this.index === undefined ? locator : locator.nth(this.index);
  }

  /**
   * Creates a new instance of the current element subtype.
   */
  private newInstance(scope: SearchScope, selector: SelectorInput, index?: number): this {
    const ElementType = this.constructor as new (
      scope: SearchScope,
      selector: SelectorInput,
      index?: number,
    ) => this;

    return new ElementType(scope, selector, index);
  }

  /**
   * Returns the underlying Playwright locator.
   */
  locator(): Locator {
    return this.resolvedLocator;
  }

  /**
   * Returns the first matching element.
   */
  first(): this {
    return this.newInstance(this.scope, this.selector, 0);
  }

  /**
   * Returns the element at a specific index.
   */
  nth(index: number): this {
    return this.newInstance(this.scope, this.selector, index);
  }

  /**
   * Returns the raw selector value.
   */
  selectorValue(): string {
    return this.selector.value;
  }

  /**
   * Clicks the element.
   */
  async click(): Promise<void> {
    await this.resolvedLocator.click();
  }

  /**
   * Clears and fills the element with text.
   */
  async fill(value: string): Promise<void> {
    await this.clear();
    await this.resolvedLocator.fill(value);
  }

  /**
   * Clears and types text sequentially into the element.
   */
  async type(value: string): Promise<void> {
    await this.clear();
    await this.resolvedLocator.pressSequentially(value);
  }

  /**
   * Clears the current element value.
   */
  private async clear(): Promise<void> {
    await this.resolvedLocator.clear();
  }

  /**
   * Returns trimmed text content from the element.
   */
  async getText(): Promise<string> {
    await this.waitForVisible();
    return (await this.resolvedLocator.textContent())?.trim() ?? '';
  }

  /**
   * Returns trimmed text contents from all matching elements.
   */
  async getTexts(): Promise<string[]> {
    await this.resolvedLocator.first().waitFor({ state: 'visible' });
    const texts = await this.resolvedLocator.allTextContents();
    return texts.map((text) => text.trim()).filter(Boolean);
  }

  /**
   * Checks whether the element is visible.
   */
  async isVisible(): Promise<boolean> {
    return this.resolvedLocator.isVisible();
  }

  /**
   * Waits until the element is visible.
   */
  async waitForVisible(): Promise<void> {
    await this.resolvedLocator.waitFor({ state: 'visible' });
  }

  /**
   * Returns the element attribute value by name.
   */
  async getAttribute(name: string): Promise<string | null> {
    await this.waitForVisible();
    return this.resolvedLocator.getAttribute(name);
  }

  /**
   * Returns number of matching elements.
   */
  async count(): Promise<number> {
    return this.resolvedLocator.count();
  }

  /**
   * Finds a child element relative to the current element.
   */
  findElement(
    childSelector: SelectorInput,
    options?: FindElementOptions,
  ): BaseElement {
    return new BaseElement(this.resolvedLocator, childSelector, options?.index);
  }
}
