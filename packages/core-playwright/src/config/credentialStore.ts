import { decryptValueFromEnv } from '../utils/cryptos.js';
import { loadJson } from '../utils/dataLoader.js';
import { resolveFromModule } from '../utils/path.js';

interface EncryptedCredential {
  id: string;
  username: string;
  encryptedPassword: string;
  encryptedSecretKey: string;
}

export interface Credential {
  id: string;
  getUsername: () => string;
  getPassword: () => string;
  getSecretKey: () => string;
}

function decryptRequired(
  value: string,
  username: string,
  field: string,
): string {
  if (value === undefined) {
    throw new Error(`Credential "${username}" is missing encrypted ${field}.`);
  }

  return decryptValueFromEnv(value.trim());
}

export function get(filePath: string, id: string): Credential {
  let record = loadJson<EncryptedCredential[]>(filePath).find(
    (r) => r.id === id,
  );

  if (!record) {
    throw new Error(`Credential "${id}" was not found in ${filePath}.`);
  }

  return {
    id: record.id,
    getUsername: () => record.username,
    getPassword: () =>
      decryptRequired(record.encryptedPassword, record.username, 'password'),
    getSecretKey: () =>
      decryptRequired(record.encryptedSecretKey, record.username, 'secret key'),
  };
}

export function getCredentials(metaUrl: string, id: string, testEnv: string, filePattern: string,): Credential;
export function getCredentials(metaUrl: string, id: string): Credential;

export function getCredentials(
  metaUrl: string,
  id: string,
  testEnv?: string,
  filePattern?: string,
): Credential {
  const env = (testEnv ?? process.env.TEST_ENV ?? 'qat').trim() || 'qat';
  let pattern = filePattern ?? '../data/credentials.{env}.json';
  let filePath = resolveFromModule(metaUrl, pattern.replaceAll('{env}', env));

  return get(filePath, id);
}
