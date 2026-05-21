/**
 * Utilities for loading XML-based bean metadata and resolving properties.
 *
 * This module provides a lightweight Spring-style bean loader for:
 * - XML bean definitions
 * - Recursive XML imports
 * - .properties configuration files
 * - Placeholder resolution
 * - Typed bean instantiation
 *
 * Supported placeholders:
 *
 * Property placeholders:
 * - ${key}
 * - ${key:default}
 *
 * Import resource placeholders:
 * - {ENV:default}
 *
 * Example:
 *
 * <bean id="environment" class="Environment">
 *   <property name="loginUrl" value="${login.url}" />
 * </bean>
 *
 * <import resource="{TARGET:QAT}Credential.xml"/>
 */

import * as fs from 'node:fs';

import * as xpath from 'xpath';

import { DOMParser } from 'xmldom';

import { resolveFromModule } from './path.js';
import { loadProperties } from './propertiesLoader.js';
import { decryptValueFromEnv } from './cryptos.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Represents environment endpoint configuration.
 */
export class Environment {
  constructor(
    /**
     * Login page URL.
     */
    readonly loginUrl = '',
    /**
     * Dashboard page URL.
     */
    readonly dashboardUrl = '',
    /**
     * Base API/webservice URL.
     */
    readonly webserviceUrl = '',
  ) {}
}

/**
 * Represents authentication credentials.
 */
export class Credential {
  constructor(
    /**
     * Username or email.
     */
    readonly username: string,
    /**
     * password
     */
    readonly password: string,
    /**
     * Optional secret/MFA key.
     */
    readonly secretKey?: string,
  ) {}
}

/**
 * Bean loader configuration.
 */
export interface BeanLoaderOptions {
  /**
   * XML metadata file path.
   */
  xmlPaths: string[];

  /**
   * List of .properties files.
   *
   * Later files override earlier keys.
   */
  propertiesPaths: string[];

  /**
   * Environment variable that selects the environment bean name.
   *
   * Defaults to "env".
   */
  env?: string;
}

export interface BeanContext {
  /**
   * Selected environment bean name.
   */
  readonly env: string;

  /**
   * All resolved environment beans keyed by name.
   */
  readonly environments: Readonly<Record<string, Environment>>;

  /**
   * All resolved credential beans keyed by name.
   */
  readonly credentials: Readonly<Record<string, Credential>>;

  /**
   * Returns the selected environment bean.
   */
  getEnvironment(): Environment;

  /**
   * Returns a credential bean by name.
   */
  getCredential(name: string): Credential;
}

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

/**
 * Loads and merges multiple .properties files.
 *
 * Later files override earlier values.
 */
function loadAllProperties(
  metaUrl: string,
  paths: string[],
): Map<string, string> {
  const merged = new Map<string, string>();

  for (const filePath of paths) {
    const propertiesPath = resolveFromModule(metaUrl, filePath);

    if (!fs.existsSync(propertiesPath)) {
      console.warn(`[BeanLoader] Properties file not found: ${filePath}`);

      continue;
    }

    const props = loadProperties(propertiesPath);

    for (const [key, value] of props.entries()) {
      merged.set(key, value);
    }
  }

  return merged;
}

/**
 * Resolves Spring-style placeholders.
 *
 * Supported: ${key}
 */
function resolveValue(
  valueAttr: string | null,
  keyAttr: string | null,
  props: Map<string, string>,
): string {
  // ---------------------------------------------------------------------------
  // Direct property lookup:
  // <property name="url" key="base.url"/>
  // ---------------------------------------------------------------------------
  if (keyAttr) {
    return (
      props.get(keyAttr) ??
      (() => {
        throw new Error(`MISSING:${keyAttr}`);
      })()
    );
  }

  // ---------------------------------------------------------------------------
  // Placeholder replacement:
  // value="${base.url}"
  // ---------------------------------------------------------------------------
  if (valueAttr) {
    // FIX 1: Cleaned up the broken nested regex quantifiers
    return valueAttr.replace(
      /\$\{([^}]+)}/g,
      (_, key: string) => {
        // FIX 2: Corrected the error variable to reference 'key', not 'keyAttr'
        return (
          props.get(key) ??
          (() => {
            throw new Error(`MISSING:${key}`);
          })()
        );
      },
    );
  }

  return '';
}

function parseXml(
  metaUrl: string,
  xmlPaths: string[],
): Document {
  if (xmlPaths.length === 0) {
    throw new Error('[BeanLoader] xmlPaths missing');
  }

  // 1. Map: Resolve all paths
  const paths = xmlPaths.map((xmlPath) => resolveFromModule(metaUrl, xmlPath));

  // 2. Extract the environment first
  const baseXml = fs.readFileSync(paths[0], 'utf-8');
  const doc = new DOMParser().parseFromString(baseXml, 'text/xml');
  const roots = xpath.select('/*', doc) as Node[];
  const beansRoot = roots[0] as Element | null;

  if (!beansRoot) {
    throw new Error(`[BeanLoader] No root element found in primary XML`);
  }

  // 3. Reduce: Stream through the remaining paths and accumulate them into the host doc
  return paths.slice(1).reduce((mainDoc, currentPath) => {
    if (!fs.existsSync(currentPath)) {
      console.warn(`[BeanLoader] Imported file not found: ${currentPath}`);
      return mainDoc;
    }

    const credentialXml = fs.readFileSync(currentPath, 'utf-8');
    const credentialsDoc = new DOMParser().parseFromString(
      credentialXml,
      'text/xml',
    );
    const credentialBeans = xpath.select('//bean', credentialsDoc) as Element[];

    // adopt and append beans
    for (const bean of credentialBeans) {
      const adopted = mainDoc.importNode(bean, true);
      beansRoot.appendChild(adopted);
    }

    return mainDoc;
  }, doc);
}

function resolveBeanKind(
  className: string,
): 'environment' | 'credential' | null {
  const normalized = className.trim();

  if (normalized === Environment.name || normalized.endsWith('.Environment')) {
    return 'environment';
  }

  if (
    normalized === Credential.name ||
    normalized.endsWith('Credential') ||
    normalized.endsWith('Credentials')
  ) {
    return 'credential';
  }

  return null;
}

function instantiateBean(
  className: string,
  resolved: Record<string, string>,
): Environment | Credential {
  const kind = resolveBeanKind(className);

  if (kind === 'environment') {
    return new Environment(
      resolved['loginUrl'],
      resolved['dashboardUrl'],
      resolved['webserviceUrl'],
    );
  }

  if (kind === 'credential') {
    return new Credential(
      resolved['username'],
      decryptValueFromEnv(resolved['password']),
      decryptValueFromEnv(resolved['secretKey']),
    );
  }

  throw new Error(`[BeanLoader] Unknown bean class: "${className}"`);
}

/**
 * Loads all supported beans into a reusable context.
 *
 * Intended for suite-level setup where environment and credential data should
 * be parsed once and reused by many tests.
 */
export function loadBeanContext(
  metaUrl: string,
  options: BeanLoaderOptions,
): BeanContext {
  const { xmlPaths, propertiesPaths } = options;
  const selectedEnv = process.env.env ?? options.env ?? 'qat';

  const doc = parseXml(metaUrl, xmlPaths);
  const props = loadAllProperties(metaUrl, propertiesPaths);
  const beanNodes = xpath.select('//bean', doc) as Element[];

  const environments: Record<string, Environment> = {};
  const credentials: Record<string, Credential> = {};

  for (const beanNode of beanNodes) {
    const beanName = beanNode.getAttribute('name');
    const className = beanNode.getAttribute('class') ?? '';
    const kind = resolveBeanKind(className);

    if (!beanName || !kind) {
      continue;
    }

    const propNodes = xpath.select('property', beanNode) as Element[];
    const resolved: Record<string, string> = {};

    for (const prop of propNodes) {
      const name = prop.getAttribute('name');

      if (!name) {
        continue;
      }

      resolved[name] = resolveValue(
        prop.getAttribute('value'),
        prop.getAttribute('key'),
        props,
      );
    }

    const bean = instantiateBean(className, resolved);

    if (kind === 'environment') {
      environments[beanName] = bean as Environment;
      continue;
    }

    credentials[beanName] = bean as Credential;
  }

  const environment = environments[selectedEnv];

  if (!environment) {
    throw new Error(
      `[BeanLoader] Environment bean with name="${selectedEnv}" not found.`,
    );
  }

  return {
    env: selectedEnv,
    environments,
    credentials,
    getEnvironment(): Environment {
      return environment;
    },
    getCredential(id: string): Credential {
      const credential = credentials[id];

      if (!credential) {
        throw new Error(
          `[BeanLoader] Credential bean with id="${id}" not found.`,
        );
      }

      return credential;
    },
  };
}
