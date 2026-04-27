export interface ApiErrorResponse {
  code: string;
  message: string;
}

export interface ApiSchemaExpectation<T extends object> {
  requiredKeys: Array<keyof T>;
}
