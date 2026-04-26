export type SelectorType = 'css' | 'xpath' | 'text';

export interface SelectorDefinition {
  type: SelectorType;
  value: string;
}

export type SelectorInput = string | SelectorDefinition;

export function normalizeSelector(selector: SelectorInput): SelectorDefinition {
  if (typeof selector !== 'string') {
    return selector;
  }

  return {
    type: inferSelectorType(selector),
    value: stripPlaywrightPrefix(selector),
  };
}

export function toPlaywrightSelector(selector: SelectorDefinition): string {
  if (selector.type === 'css') {
    return selector.value;
  }

  return `${selector.type}=${selector.value}`;
}

function inferSelectorType(selector: string): SelectorType {
  if (selector.startsWith('xpath=')) {
    return 'xpath';
  }

  if (selector.startsWith('text=')) {
    return 'text';
  }

  if (
    selector.startsWith('//') ||
    selector.startsWith('.//') ||
    selector.startsWith('(')
  ) {
    return 'xpath';
  }

  return 'css';
}

function stripPlaywrightPrefix(selector: string): string {
  if (selector.startsWith('xpath=')) {
    return selector.slice('xpath='.length);
  }

  if (selector.startsWith('text=')) {
    return selector.slice('text='.length);
  }

  return selector;
}
