import { test as base, expect } from '@playwright/test';

import {
  type BeanContext,
  type BeanContextOptions,
  type Credential,
  type Environment,
  loadBeanContext,
} from '../utils/beanLoader.js';

export interface BaseTestDebugOptions {
  /**
   * Default environment bean id used only when no cross-env value is provided.
   */
  env?: string;

  /**
   * Default credential target import used only when no cross-env value is provided.
   */
  credTarget?: string;

  /**
   * Additional debug-only variable fallbacks.
   */
  variables?: Record<string, string | undefined>;
}

export interface CreateBaseTestOptions extends BeanContextOptions {
  metaUrl: string;
  debug?: BaseTestDebugOptions;
}

export interface BeanFixtures {
  environment: Environment;
  getCredential: (id: string) => Credential;
}

export interface BeanWorkerFixtures {
  beanContext: BeanContext;
}

function resolveRuntimeVariables(
  options: CreateBaseTestOptions,
): Record<string, string | undefined> {
  const debugVariables = options.debug?.variables ?? {};

  return {
    ...debugVariables,
    env: options.debug?.env ?? debugVariables['env'],
    'target.cred':
      options.debug?.credTarget ?? debugVariables['target.cred'],
    ...options.variables,
    ...process.env,
  };
}

/**
 * Creates a shared Playwright base test with suite-level bean preloading.
 *
 * Cross-env values always win. Debug defaults are only used when those
 * variables are absent.
 */
export function createBaseTest(
  options: CreateBaseTestOptions,
) {
  const {
    metaUrl,
    debug: _debug,
    xmlPath,
    propertiesPaths,
    envVarName,
    defaultEnv,
  } = options;

  return base.extend<BeanFixtures, BeanWorkerFixtures>({
    beanContext: [
      async ({}, use) => {
        const variables = resolveRuntimeVariables(options);
        const beanContext = loadBeanContext(metaUrl, {
          xmlPath,
          propertiesPaths,
          envVarName,
          defaultEnv,
          variables,
        });

        await use(beanContext);
      },
      { scope: 'worker' },
    ],
    environment: async ({ beanContext }, use) => {
      await use(beanContext.getEnvironment());
    },
    getCredential: async ({ beanContext }, use) => {
      await use((id: string) => beanContext.getCredential(id));
    },
  });
}

export { expect };
