export type ExpectedResult =
  | { type: 'error'; messages: string[] }
  | { type: 'success'; urlContains: string };

export interface LoginTestData {
  name: string;
  tags?: string[];
  username?: string;
  password?: string;
  expected: ExpectedResult;
}
