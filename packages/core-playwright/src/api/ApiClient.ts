import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ApiErrorResponse, ApiSchemaExpectation } from './types.js';

export class ApiClient {
  constructor(private readonly requestContext: APIRequestContext) {}

  get context(): APIRequestContext {
    return this.requestContext;
  }

  async get(url: string, options?: Parameters<APIRequestContext['get']>[1]): Promise<APIResponse> {
    return this.requestContext.get(url, options);
  }

  async post(url: string, options?: Parameters<APIRequestContext['post']>[1]): Promise<APIResponse> {
    return this.requestContext.post(url, options);
  }

  async put(url: string, options?: Parameters<APIRequestContext['put']>[1]): Promise<APIResponse> {
    return this.requestContext.put(url, options);
  }

  async patch(url: string, options?: Parameters<APIRequestContext['patch']>[1]): Promise<APIResponse> {
    return this.requestContext.patch(url, options);
  }

  async delete(url: string, options?: Parameters<APIRequestContext['delete']>[1]): Promise<APIResponse> {
    return this.requestContext.delete(url, options);
  }

  async expectOk(response: APIResponse): Promise<void> {
    expect(response.ok()).toBeTruthy();
  }

  async expectStatus(response: APIResponse, status: number): Promise<void> {
    expect(response.status()).toBe(status);
  }

  async json<T>(response: APIResponse): Promise<T> {
    return await response.json() as Promise<T>;
  }

  async extract<T>(response: APIResponse): Promise<T> {
    return this.json<T>(response);
  }

  async extractList<T>(response: APIResponse): Promise<T[]> {
    return this.json<T[]>(response);
  }

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

  async expectErrorCode(response: APIResponse, status: number, code: string): Promise<ApiErrorResponse> {
    return this.expectError(response, { status, code });
  }

  async expectErrorMessage(
    response: APIResponse,
    status: number,
    message: string,
  ): Promise<ApiErrorResponse> {
    return this.expectError(response, { status, message });
  }

  async dispose(): Promise<void> {
    await this.requestContext.dispose();
  }
}
