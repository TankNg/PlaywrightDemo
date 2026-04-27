import {
  request as playwrightRequest,
  test as base,
  type TestType,
} from '@playwright/test';
import { ApiClient } from './ApiClient.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('core.api.fixture');

export interface ApiFixtureOptions {
  baseURL?: string;
  extraHTTPHeaders?: Record<string, string>;
  ignoreHTTPSErrors?: boolean;
}

export interface ApiFixture {
  api: ApiClient;
}

/**
 * Resolves Playwright API request context options from fixture settings.
 */
function resolveApiContextOptions(
  options: ApiFixtureOptions = {},
): Parameters<typeof playwrightRequest.newContext>[0] {
  return {
    baseURL: options.baseURL ?? process.env.API_BASE_URL ?? process.env.BASE_URL,
    extraHTTPHeaders: options.extraHTTPHeaders,
    ignoreHTTPSErrors: options.ignoreHTTPSErrors,
  };
}

/**
 * Creates a Playwright test type extended with an API client fixture.
 */
export function createApiTest(
  options: ApiFixtureOptions = {},
): TestType<ApiFixture, object> {
  return base.extend<ApiFixture>({
    api: async ({}, use) => {
      logger.debug('Creating API request context');
      const requestContext = await playwrightRequest.newContext(
        resolveApiContextOptions(options),
      );
      const api = new ApiClient(requestContext);

      await use(api);
      logger.debug('Disposing API fixture');
      await api.dispose();
    },
  });
}
