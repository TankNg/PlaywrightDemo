import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves paths relative to the current project root.
 *
 * Example:
 * projects/projectName/tests
 * -> projects/projectName/
 */
export function resolveFromModule(metaUrl: string, ...paths: string[]): string {
  const currentFile = fileURLToPath(metaUrl);

  const parts = currentFile.split(path.sep);

  const projectsIndex = parts.indexOf('projects');

  if (projectsIndex === -1 || projectsIndex + 1 >= parts.length) {
    throw new Error('projects folder not found');
  }

  const projectRoot = parts.slice(0, projectsIndex + 2).join(path.sep);

  return path.resolve(projectRoot, ...paths);
}