import crypto from 'node:crypto';

const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function buildKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function getEncryptionKeyFromEnv(): string {
  const key = process.env.SECRET_KEY;

  if (!key) {
    throw new Error('Missing SECRET_KEY environment variable.');
  }

  return key;
}
export function generateSecretKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64url');
}

export function encryptValue(plainText: string, secretKey: string): string;
export function encryptValue(plainText: string): string;

export function encryptValue(plainText: string, secretKey?: string): string {
  const key = secretKey ?? getEncryptionKeyFromEnv();

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', buildKey(key), iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptValue(plainText: string, secretKey: string): string;
export function decryptValue(plainText: string): string;
export function decryptValue(encryptedValue: string, secretKey?: string): string {
  const parts = encryptedValue.split(':');
  const key = secretKey ?? getEncryptionKeyFromEnv();
  const [iv, authTag, encrypted] =
    parts.length === 5 ? parts.slice(2) : parts;

  if (!iv || !authTag || !encrypted || parts.length < 3 || parts.length > 5) {
    throw new Error('Invalid encrypted value format.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    buildKey(key),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function decryptValueFromEnv(encryptedValue: string): string {
  return decryptValue(encryptedValue, getEncryptionKeyFromEnv());
}
