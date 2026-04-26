import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveFromModule(metaUrl: string, ...paths: string[]): string {
  const currentFile = fileURLToPath(metaUrl);
  return path.resolve(path.dirname(currentFile), ...paths);
}
