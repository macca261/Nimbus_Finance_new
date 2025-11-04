import iconv from 'iconv-lite';
import { TextDecoder } from 'node:util';

const REPLACEMENT = '\uFFFD';

export type Decoded = { text: string; encoding: 'utf8' | 'win1252' };

export function decodeCsvBuffer(buf: Buffer): Decoded {
  // 1) Strict UTF-8 attempt
  try {
    const td = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    const text = td.decode(buf);
    // If strict decode succeeded but contains replacement char, treat as suspicious.
    if (text.includes(REPLACEMENT)) {
      throw new Error('suspicious replacement char after utf8 decode');
    }
    // Heuristic: check C1 controls 0x80–0x9F which indicate cp1252 frequently
    let c1 = 0;
    for (const b of buf) if (b >= 0x80 && b <= 0x9f) c1++;
    if (c1 > 0) {
      // Prefer cp1252 if C1 controls present
      const cp = iconv.decode(buf, 'win1252');
      return { text: cp, encoding: 'win1252' };
    }
    return { text, encoding: 'utf8' };
  } catch {
    // 2) Fallback to Windows-1252
    const text = iconv.decode(buf, 'win1252');
    return { text, encoding: 'win1252' };
  }
}


