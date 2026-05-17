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
import * as path from 'node:path';

import * as xpath from 'xpath';

import { DOMParser } from 'xmldom';

import { resolveFromModule } from './path.js';
import { loadProperties } from './propertiesLoader.js';

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
     * Password
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
  xmlPath: string;

  /**
   * List of .properties files.
   *
   * Later files override earlier keys.
   */
  propertiesPaths: string[];

  /**
   * Optional target/profile name.
   */
  target?: string;
}

export interface BeanContextOptions extends BeanLoaderOptions {
  /**
   * Environment variable that selects the environment bean id.
   *
   * Defaults to "env".
   */
  envVarName?: string;

  /**
   * Default environment bean id when the environment variable is not set.
   *
   * Defaults to "qat".
   */
  defaultEnv?: string;
}

export interface BeanContext {
  /**
   * Selected environment bean id.
   */
  readonly env: string;

  /**
   * Snapshot of all process environment variables used by the bean context.
   */
  readonly variables: Readonly<Record<string, string | undefined>>;

  /**
   * All resolved environment beans keyed by id.
   */
  readonly environments: Readonly<Record<string, Environment>>;

  /**
   * All resolved credential beans keyed by id.
   */
  readonly credentials: Readonly<Record<string, Credential>>;

  /**
   * Returns the selected environment bean.
   */
  getEnvironment(): Environment;

  /**
   * Returns a credential bean by id.
   */
  getCredential(id: string): Credential;
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
 * Supported:
 * - ${key}
 * - ${key:default}
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
    return props.get(keyAttr) ?? `MISSING:${keyAttr}`;
  }

  // ---------------------------------------------------------------------------
  // Placeholder replacement:
  // value="${base.url}"
  // value="${base.url:https://default.com}"
  // ---------------------------------------------------------------------------
  if (valueAttr) {
    return valueAttr.replace(
      /\$\{([^}]+?)(?::([^}]*))?}/g,
      (_, key: string, fallback?: string) => {
        return props.get(key) ?? fallback ?? `MISSING:${key}`;
      },
    );
  }

  return '';
}

/**
 * Recursively parses XML and resolves <import resource="Config.xml"/>.
 */
function parseXmlWithImports(xmlPath: string): Document {
  const xml = fs.readFileSync(xmlPath, 'utf-8');

  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  const importNodes = xpath.select('//import[@resource]', doc) as Element[];

  for (const importNode of importNodes) {
    const resource = importNode.getAttribute('resource');

    if (!resource) {
      continue;
    }

    const importPath = path.resolve(
      path.dirname(xmlPath),
      resolveResource(resource),
    );

    if (!fs.existsSync(importPath)) {
      console.warn(`[BeanLoader] Imported file not found: ${importPath}`);

      continue;
    }

    const importedDoc = parseXmlWithImports(importPath);

    const importedBeans = xpath.select('//bean', importedDoc) as Element[];

    const roots = xpath.select('/*', doc) as Node[];

    const beansRoot = roots[0] as Element | null;

    if (!beansRoot) {
      console.warn(`[BeanLoader] No root element found in: ${xmlPath}`);

      continue;
    }

    for (const bean of importedBeans) {
      const adopted = doc.importNode(bean, true);

      beansRoot.appendChild(adopted);
    }
  }

  return doc;
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
    normalized.endsWith('.Credential') ||
    normalized.endsWith('.Credentials')
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
      resolved['password'],
      resolved['secretKey'],
    );
  }

  throw new Error(`[BeanLoader] Unknown bean class: "${className}"`);
}

// -----------------------------------------------------------------------------
// Import Resource Resolution
// -----------------------------------------------------------------------------

/**
 * Matches:
 * {TARGET:QAT}
 */
const PLACEHOLDER_REGEX = /\{([^:}]+):([^}]+)}/g;

/**
 * Resolves environment placeholders inside import resources.
 *
 * Example:
 * {TARGET:QAT}Credential.xml
 *
 * TARGET=DEV
 * -> DEVCredential.xml
 *
 * Missing TARGET
 * -> QATCredential.xml
 */
function resolveResource(resource: string): string {
  return resource.replace(
    PLACEHOLDER_REGEX,
    (_, envKey: string, defaultVal: string) => {
      return process.env[envKey] ?? defaultVal;
    },
  );
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Loads and resolves a bean from XML metadata.
 *
 * Features:
 * - XML bean lookup
 * - Recursive imports
 * - .properties merging
 * - Placeholder resolution
 * - Typed bean creation
 *
 * Supported bean classes:
 * - Environment
 * - Credential
 *
 * Example:
 *
 * const env = getBeanById<Environment>(
 *   import.meta.url,
 *   {
 *     xmlPath: 'resources/beans.xml',
 *     propertiesPaths: [
 *       'resources/application.properties'
 *     ]
 *   },
 *   'environment'
 * );
 */
export function getBeanById<T extends Environment | Credential>(
  metaUrl: string,
  options: BeanLoaderOptions,
  beanId: string,
): T {
  const { xmlPath, propertiesPaths } = options;

  const resolvedXmlPath = resolveFromModule(metaUrl, xmlPath);

  if (!fs.existsSync(resolvedXmlPath)) {
    throw new Error(`[BeanLoader] XML file not found: ${xmlPath}`);
  }

  // ---------------------------------------------------------------------------
  // Parse XML with recursive imports
  // ---------------------------------------------------------------------------
  const doc = parseXmlWithImports(resolvedXmlPath);

  // ---------------------------------------------------------------------------
  // Load properties
  // ---------------------------------------------------------------------------
  const props = loadAllProperties(metaUrl, propertiesPaths);

  // ---------------------------------------------------------------------------
  // Find bean node
  // ---------------------------------------------------------------------------
  const beansRoot = (xpath.select('/*', doc) as Node[])[0] as Element;

  const nodes = xpath.select(`//bean[@id="${beanId}"]`, beansRoot) as Element[];

  if (!nodes.length) {
    throw new Error(`[BeanLoader] Bean with id="${beanId}" not found.`);
  }

  const beanNode = nodes[0];

  // ---------------------------------------------------------------------------
  // Resolve bean properties
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Create typed instance
  // ---------------------------------------------------------------------------
  const className = beanNode.getAttribute('class') ?? '';

  return instantiateBean(className, resolved) as T;
}

/**
 * Loads all supported beans into a reusable context.
 *
 * Intended for suite-level setup where environment and credential data should
 * be parsed once and reused by many tests.
 */
export function loadBeanContext(
  metaUrl: string,
  options: BeanContextOptions,
): BeanContext {
  const { xmlPath, propertiesPaths } = options;
  const envVarName = options.envVarName ?? 'env';
  const defaultEnv = options.defaultEnv ?? 'qat';
  const selectedEnv = process.env[envVarName] ?? defaultEnv;
  const resolvedXmlPath = resolveFromModule(metaUrl, xmlPath);

  if (!fs.existsSync(resolvedXmlPath)) {
    throw new Error(`[BeanLoader] XML file not found: ${xmlPath}`);
  }

  const doc = parseXmlWithImports(resolvedXmlPath);
  const props = loadAllProperties(metaUrl, propertiesPaths);
  const beanNodes = xpath.select('//bean', doc) as Element[];

  const environments: Record<string, Environment> = {};
  const credentials: Record<string, Credential> = {};

  for (const beanNode of beanNodes) {
    const beanId = beanNode.getAttribute('id');
    const className = beanNode.getAttribute('class') ?? '';
    const kind = resolveBeanKind(className);

    if (!beanId || !kind) {
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
      environments[beanId] = bean as Environment;
      continue;
    }

    credentials[beanId] = bean as Credential;
  }

  const environment = environments[selectedEnv];

  if (!environment) {
    throw new Error(
      `[BeanLoader] Environment bean with id="${selectedEnv}" not found.`,
    );
  }

  return {
    env: selectedEnv,
    variables: {
      [envVarName]: process.env[envVarName],
      'target.cred': process.env['target.cred'],
    },
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
