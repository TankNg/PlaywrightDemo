import { loadJson } from '../utils/dataLoader.js';
import { resolveFromModule } from '../utils/path.js';

export type EnvValue = string | number | boolean;

export interface EnvironmentJsonConfig {
  run?: Record<string, EnvValue>;
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
  const env =
    (options.testEnv ?? process.env.TEST_ENV ?? 'qat').trim() || 'qat';
  const filePath = resolveFromModule(
    options.metaUrl,
    options.configRelativePath ?? '../../data/environment.json',
  );
  const config = loadJson<EnvironmentJsonConfig>(filePath);
  const envValues = config.environments[env];

  if (!envValues) {
    throw new Error(`Environment "${env}" is not configured in ${filePath}.`);
  }

  const runConfig = options.runConfig ?? config.run ?? DEFAULT_RUN_CONFIG;
  applyEnv(runConfig);
  applyEnv(envValues);

  return env;
}

export interface Environment {
  baseUrl: string;
  loginUrl: string;
  dashboardUrl?: string;
  apiBaseUrl?: string;
}

function normalizeRequiredUrl(value: string | undefined, key: string): string {
  if (!value?.trim()) {
    throw new Error(`Missing required environment url "${key}".`);
  }

  return value.trim();
}

function normalizeOptionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getEnvironment(): Environment {
  const baseUrl = normalizeRequiredUrl(process.env.BASE_URL, 'BASE_URL');
  const loginUrl = normalizeRequiredUrl(process.env.LOGIN_URL, 'LOGIN_URL');
  const dashboardUrl = normalizeOptionalUrl(process.env.DASHBOARD_URL);
  const apiBaseUrl = normalizeOptionalUrl(process.env.API_BASE_URL);

  return {
    baseUrl,
    loginUrl,
    dashboardUrl,
    apiBaseUrl,
  };
}
