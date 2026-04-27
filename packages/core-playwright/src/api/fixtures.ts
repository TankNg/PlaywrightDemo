import {
  request as playwrightRequest,
  test as base,
  type TestType,
} from '@playwright/test';
import { ApiClient } from './ApiClient.js';

export interface ApiFixtureOptions {
  baseURL?: string;
  extraHTTPHeaders?: Record<string, string>;
  ignoreHTTPSErrors?: boolean;
}

export interface ApiFixture {
  api: ApiClient;
}

function resolveApiContextOptions(
  options: ApiFixtureOptions = {},
): Parameters<typeof playwrightRequest.newContext>[0] {
  return {
    baseURL: options.baseURL ?? process.env.API_BASE_URL ?? process.env.BASE_URL,
    extraHTTPHeaders: options.extraHTTPHeaders,
    ignoreHTTPSErrors: options.ignoreHTTPSErrors,
  };
}

export function createApiTest(
  options: ApiFixtureOptions = {},
): TestType<ApiFixture, object> {
  return base.extend<ApiFixture>({
    api: async ({}, use) => {
      const requestContext = await playwrightRequest.newContext(
        resolveApiContextOptions(options),
      );
      const api = new ApiClient(requestContext);

      await use(api);
      await api.dispose();
    },
  });
}
