import iconv from 'iconv-lite';
import { toUtf8 } from './encoding';

export function decodeCsvBuffer(buf: Buffer): string {
  try {
    return toUtf8(buf);
  } catch {
    try { return iconv.decode(buf, 'windows-1252'); } catch { return buf.toString('utf8'); }
  }
}


