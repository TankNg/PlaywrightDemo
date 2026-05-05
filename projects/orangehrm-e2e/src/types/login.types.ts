export type ExpectedResult =
  | { type: 'error'; messages: string[] }
  | { type: 'success'; urlContains: string };

export interface LoginTestData {
  name: string;
  tags?: string[];
  id: string;
  expected: ExpectedResult;
}
