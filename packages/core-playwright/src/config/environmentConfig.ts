import { loadJson } from '../utils/dataLoader.js';
import { resolveFromModule } from '../utils/path.js';
import {
  createCredentialStoreFromJson,
  CredentialStore,
} from './credentialStore.js';

export type EnvValue = string | number | boolean;

export interface EnvironmentJsonConfig {
  environments: Record<string, Record<string, EnvValue>>;
}

const DEFAULT_RUN_CONFIG: Record<string, EnvValue> = {
  PW_PARALLEL: false,
  PW_RUN_MODE: 'headless',
  PW_BROWSERS: 'chromium',
  PW_GROUPS: 'smoke',
};

function applyEnv(values: Record<string, EnvValue>): void {
  Object.entries(values).forEach(([key, value]) => {
    process.env[key] = String(value);
  });
}

export interface LoadEnvironmentConfigOptions {
  metaUrl: string;
  configRelativePath?: string;
  testEnv?: string;
  runConfig?: Record<string, EnvValue>;
}

export function loadEnvironmentConfigFromJson(
  options: LoadEnvironmentConfigOptions,
): string {
  const env = (options.testEnv ?? process.env.TEST_ENV ?? 'qat').trim() || 'qat';
  const filePath = resolveFromModule(
    options.metaUrl,
    options.configRelativePath ?? '../../data/environment.json',
  );
  const config = loadJson<EnvironmentJsonConfig>(filePath);
  const envValues = config.environments[env];

  if (!envValues) {
    throw new Error(`Environment "${env}" is not configured in ${filePath}.`);
  }

  applyEnv(options.runConfig ?? DEFAULT_RUN_CONFIG);
  applyEnv(envValues);

  return env;
}

export interface ProjectConfig {
  urls: {
    baseUrl: string;
    loginUrl: string;
    dashboardUrl?: string;
    apiBaseUrl?: string;
  };
  credentialStore: CredentialStore;
}

const DEFAULT_BASE_URL = 'https://opensource-demo.orangehrmlive.com';

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}


export function createProjectConfig(metaUrl: string): ProjectConfig {
  const baseUrl = normalizeUrl(process.env.BASE_URL) ?? DEFAULT_BASE_URL;
  const loginUrl = normalizeUrl(process.env.LOGIN_URL) ?? baseUrl;
  const dashboardUrl = normalizeUrl(process.env.DASHBOARD_URL);
  const apiBaseUrl = normalizeUrl(process.env.API_BASE_URL);
  const credentialStore = createCredentialStoreFromJson({ metaUrl });

  return {
    urls: {
      baseUrl,
      loginUrl,
      dashboardUrl,
      apiBaseUrl,
    },
    credentialStore,
  };
}

