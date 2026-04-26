import fs from 'node:fs';

export function loadJson<T>(path: string): T {
  const data = fs.readFileSync(path, 'utf-8');
  return JSON.parse(data) as T;
}
