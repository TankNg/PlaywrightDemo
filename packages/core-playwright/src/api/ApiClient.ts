import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ApiErrorResponse, ApiSchemaExpectation } from './types.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('core.api.client');

export class ApiClient {
  /**
   * Creates an API client wrapper around Playwright request context.
   */
  constructor(private readonly requestContext: APIRequestContext) {}

  /**
   * Returns the underlying Playwright request context.
   */
  get context(): APIRequestContext {
    return this.requestContext;
  }

  /**
   * Sends an HTTP GET request.
   */
  async get(url: string, options?: Parameters<APIRequestContext['get']>[1]): Promise<APIResponse> {
    logger.debug(`GET ${url}`);
    return this.requestContext.get(url, options);
  }

  /**
   * Sends an HTTP POST request.
   */
  async post(url: string, options?: Parameters<APIRequestContext['post']>[1]): Promise<APIResponse> {
    logger.debug(`POST ${url}`);
    return this.requestContext.post(url, options);
  }

  /**
   * Sends an HTTP PUT request.
   */
  async put(url: string, options?: Parameters<APIRequestContext['put']>[1]): Promise<APIResponse> {
    logger.debug(`PUT ${url}`);
    return this.requestContext.put(url, options);
  }

  /**
   * Sends an HTTP PATCH request.
   */
  async patch(url: string, options?: Parameters<APIRequestContext['patch']>[1]): Promise<APIResponse> {
    logger.debug(`PATCH ${url}`);
    return this.requestContext.patch(url, options);
  }

  /**
   * Sends an HTTP DELETE request.
   */
  async delete(url: string, options?: Parameters<APIRequestContext['delete']>[1]): Promise<APIResponse> {
    logger.debug(`DELETE ${url}`);
    return this.requestContext.delete(url, options);
  }

  /**
   * Verifies that a response is successful.
   */
  async expectOk(response: APIResponse): Promise<void> {
    expect(response.ok()).toBeTruthy();
  }

  /**
   * Verifies that a response matches an expected status code.
   */
  async expectStatus(response: APIResponse, status: number): Promise<void> {
    logger.debug(`Expect status ${status}, actual ${response.status()}`);
    expect(response.status()).toBe(status);
  }

  /**
   * Parses response body as JSON with the provided type.
   */
  async json<T>(response: APIResponse): Promise<T> {
    return await response.json() as Promise<T>;
  }

  /**
   * Extracts a typed object from a JSON response.
   */
  async extract<T>(response: APIResponse): Promise<T> {
    return this.json<T>(response);
  }

  /**
   * Extracts a typed array from a JSON response.
   */
  async extractList<T>(response: APIResponse): Promise<T[]> {
    return this.json<T[]>(response);
  }

  /**
   * Verifies required keys and values on a payload object.
   */
  async verifyRequiredKeys<T extends object>(
    payload: T,
    expected: ApiSchemaExpectation<T>,
  ): Promise<T> {
    for (const key of expected.requiredKeys) {
      expect(Object.prototype.hasOwnProperty.call(payload, key as string)).toBeTruthy();
      expect(payload[key]).not.toBeUndefined();
      expect(payload[key]).not.toBeNull();
    }

    return payload;
  }

  /**
   * Extracts and validates a single payload from a response.
   */
  async extractAndVerify<T extends object>(
    response: APIResponse,
    expected: {
      status?: number;
      schema: ApiSchemaExpectation<T>;
    },
  ): Promise<T> {
    if (expected.status !== undefined) {
      await this.expectStatus(response, expected.status);
    }

    const payload = await this.extract<T>(response);
    return this.verifyRequiredKeys(payload, expected.schema);
  }

  /**
   * Extracts and validates a list payload from a response.
   */
  async extractListAndVerify<T extends object>(
    response: APIResponse,
    expected: {
      status?: number;
      schema: ApiSchemaExpectation<T>;
    },
  ): Promise<T[]> {
    if (expected.status !== undefined) {
      await this.expectStatus(response, expected.status);
    }

    const payload = await this.extractList<T>(response);
    for (const item of payload) {
      await this.verifyRequiredKeys(item, expected.schema);
    }

    return payload;
  }

  /**
   * Validates a structured API error response.
   */
  async expectError(
    response: APIResponse,
    expected: {
      status?: number;
      code?: string;
      message?: string;
    },
  ): Promise<ApiErrorResponse> {
    if (expected.status !== undefined) {
      await this.expectStatus(response, expected.status);
    }

    const error = await this.extract<ApiErrorResponse>(response);

    expect(typeof error.code).toBe('string');
    expect(typeof error.message).toBe('string');

    if (expected.code !== undefined) {
      expect(error.code).toBe(expected.code);
    }

    if (expected.message !== undefined) {
      expect(error.message).toBe(expected.message);
    }

    return error;
  }

  /**
   * Validates API error status and error code.
   */
  async expectErrorCode(response: APIResponse, status: number, code: string): Promise<ApiErrorResponse> {
    return this.expectError(response, { status, code });
  }

  /**
   * Validates API error status and error message.
   */
  async expectErrorMessage(
    response: APIResponse,
    status: number,
    message: string,
  ): Promise<ApiErrorResponse> {
    return this.expectError(response, { status, message });
  }

  /**
   * Disposes the underlying request context.
   */
  async dispose(): Promise<void> {
    logger.debug('Disposing API request context');
    await this.requestContext.dispose();
  }
}
