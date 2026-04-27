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

  constructor(scope: SearchScope, selector: SelectorInput, index?: number) {
    this.scope = scope;
    this.selector = normalizeSelector(selector);
    this.index = index;
  }

  private get resolvedLocator(): Locator {
    const locator = this.scope.locator(toPlaywrightSelector(this.selector));
    return this.index === undefined ? locator : locator.nth(this.index);
  }

  private newInstance(scope: SearchScope, selector: SelectorInput, index?: number): this {
    const ElementType = this.constructor as new (
      scope: SearchScope,
      selector: SelectorInput,
      index?: number,
    ) => this;

    return new ElementType(scope, selector, index);
  }

  locator(): Locator {
    return this.resolvedLocator;
  }

  first(): this {
    return this.newInstance(this.scope, this.selector, 0);
  }

  nth(index: number): this {
    return this.newInstance(this.scope, this.selector, index);
  }

  selectorValue(): string {
    return this.selector.value;
  }

  async click(): Promise<void> {
    await this.resolvedLocator.click();
  }

  async fill(value: string): Promise<void> {
    await this.clear();
    await this.resolvedLocator.fill(value);
  }

  async type(value: string): Promise<void> {
    await this.clear();
    await this.resolvedLocator.pressSequentially(value);
  }

  private async clear(): Promise<void> {
    await this.resolvedLocator.clear();
  }

  async getText(): Promise<string> {
    await this.waitForVisible();
    return (await this.resolvedLocator.textContent())?.trim() ?? '';
  }

  async getTexts(): Promise<string[]> {
    await this.resolvedLocator.first().waitFor({ state: 'visible' });
    const texts = await this.resolvedLocator.allTextContents();
    return texts.map((text) => text.trim()).filter(Boolean);
  }

  async isVisible(): Promise<boolean> {
    return this.resolvedLocator.isVisible();
  }

  async waitForVisible(): Promise<void> {
    await this.resolvedLocator.waitFor({ state: 'visible' });
  }

  async getAttribute(name: string): Promise<string | null> {
    await this.waitForVisible();
    return this.resolvedLocator.getAttribute(name);
  }

  async count(): Promise<number> {
    return this.resolvedLocator.count();
  }

  findElement(
    childSelector: SelectorInput,
    options?: FindElementOptions,
  ): BaseElement {
    return new BaseElement(this.resolvedLocator, childSelector, options?.index);
  }
}
