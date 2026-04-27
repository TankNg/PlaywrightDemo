export type ExpectedResult =
  | { type: 'error'; messages: string[] }
  | { type: 'success'; urlContains: string };

export interface LoginTestData {
  name: string;
  username: string;
  encryptedPassword?: string;
  expected: ExpectedResult;
}
