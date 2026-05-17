/**
 * Lightweight Java-style .properties file loader.
 *
 * Features:
 * - Supports standard key=value syntax
 * - Ignores empty lines
 * - Ignores comments starting with '#' or '!'
 * - Trims surrounding whitespace
 * - Returns values as Map<string, string>
 *
 * Example:
 *
 * application.properties
 * --------------------------------
 * base.url=https://example.com
 * username=admin
 * password=secret
 *
 * Result:
 * --------------------------------
 * Map {
 *   'base.url' => 'https://example.com',
 *   'username' => 'admin',
 *   'password' => 'secret'
 * }
 */

import fs from 'node:fs';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Loads a .properties file into a Map<string, string>.
 *
 * Supported syntax:
 *
 * key=value
 *
 * Comments:
 * - # comment
 * - ! comment
 *
 * Invalid lines without '=' are ignored.
 *
 * Example:
 *
 * application.properties
 * --------------------------------
 * base.url=https://example.com
 * username=admin
 * password=secret
 *
 * Usage:
 *
 * const props = loadProperties(
 *   './application.properties'
 * );
 *
 * console.log(props.get('base.url'));
 *
 * @param filePath Path to a .properties file
 *
 * @returns Map containing all resolved key/value pairs
 *
 * @throws Error if file is not a .properties file
 */
export function loadProperties(filePath: string): Map<string, string> {
  // ---------------------------------------------------------------------------
  // Validate file extension
  // ---------------------------------------------------------------------------
  if (!filePath.endsWith('.properties')) {
    throw new Error(
      `[PropertiesLoader] Only .properties files are supported: ${filePath}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Read file content
  // ---------------------------------------------------------------------------
  const content = fs.readFileSync(filePath, 'utf-8');

  const map = new Map<string, string>();

  // ---------------------------------------------------------------------------
  // Split file into lines
  // ---------------------------------------------------------------------------
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // -------------------------------------------------------------------------
    // Ignore:
    // - empty lines
    // - # comments
    // - ! comments
    // -------------------------------------------------------------------------
    if (line.length === 0 || line.startsWith('#') || line.startsWith('!')) {
      continue;
    }

    // -------------------------------------------------------------------------
    // Find key=value separator
    // -------------------------------------------------------------------------
    const index = line.indexOf('=');

    // -------------------------------------------------------------------------
    // Ignore invalid lines
    // -------------------------------------------------------------------------
    if (index === -1) {
      continue;
    }

    // -------------------------------------------------------------------------
    // Extract key/value
    // -------------------------------------------------------------------------
    const key = line.slice(0, index).trim();

    const value = line.slice(index + 1).trim();

    // -------------------------------------------------------------------------
    // Store property
    // -------------------------------------------------------------------------
    map.set(key, value);
  }

  return map;
}
