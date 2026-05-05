import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Resolves paths relative to the current module URL.
 */
export function resolveFromModule(metaUrl: string, ...paths: string[]): string {
  const currentFile = fileURLToPath(metaUrl);
  return path.resolve(path.dirname(currentFile), ...paths);
}
