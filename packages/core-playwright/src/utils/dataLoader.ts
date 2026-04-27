import fs from 'node:fs';
import { getLogger } from './logger.js';

const logger = getLogger('core.utils.dataLoader');

/**
 * Loads and parses a JSON file as typed data.
 */
export function loadJson<T>(path: string): T {
  logger.debug(`Loading JSON data from: ${path}`);
  const data = fs.readFileSync(path, 'utf-8');
  return JSON.parse(data) as T;
}
