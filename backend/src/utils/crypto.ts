import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || 'dev-secret-change-me';
  return createHash('sha256').update(secret).digest(); // 32 bytes
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptToken(tokenEnc: string): string {
  const buf = Buffer.from(tokenEnc, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}


