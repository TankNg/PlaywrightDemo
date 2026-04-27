import { decryptValueFromEnv } from '../utils/cryptos.js';
import { loadJson } from '../utils/dataLoader.js';
import { resolveFromModule } from '../utils/path.js';

export interface StoredCredentialRecord {
  username: string;
  encryptedPassword: string;
  encryptedSecretKey: string;
}

export interface Credential {
  username: string;
  getPassword: () => string;
  getSecretKey: () => string;
}

export interface CredentialStore {
  get: (username: string) => Credential;
}

function decryptRequired(
  value: string,
  username: string,
  field: string,
): string {
  if (!value?.trim()) {
    throw new Error(`Credential "${username}" is missing encrypted ${field}.`);
  }

  return decryptValueFromEnv(value.trim());
}

export function createCredentialStore(
  filePath: string
): CredentialStore {
  const records = loadJson<StoredCredentialRecord[]>(filePath);
  const byUsername = new Map(
    records.map((record) => [record.username.trim().toLowerCase(), record]),
  );

  return {
    get(username: string): Credential {
      const record = byUsername.get(username.trim().toLowerCase());
      if (!record) {
        throw new Error(
          `Credential "${username}" was not found in ${filePath}.`,
        );
      }

      return {
        username: record.username,
        getPassword: () =>
          decryptRequired(
            record.encryptedPassword,
            record.username,
            'password',
          ),
        getSecretKey: () =>
          decryptRequired(
            record.encryptedSecretKey,
            record.username,
            'secret key',
          ),
      };
    },
  };
}

export interface CreateCredentialStoreFromJsonOptions {
  metaUrl: string;
  testEnv?: string;
  filePattern?: string;
}

export function createCredentialStoreFromJson(
  options: CreateCredentialStoreFromJsonOptions,
): CredentialStore {
  const env =
    (options.testEnv ?? process.env.TEST_ENV ?? 'qat').trim() || 'qat';
  const filePattern =
    options.filePattern ?? '../../data/credentials.{env}.json';
  const filePath = resolveFromModule(
    options.metaUrl,
    filePattern.replaceAll('{env}', env),
  );

  return createCredentialStore(filePath);
}
