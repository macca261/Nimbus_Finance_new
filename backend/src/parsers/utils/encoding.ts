import iconv from 'iconv-lite';

export function decodeBufferSmart(buf: Buffer): { text: string; encoding: 'utf8'|'win1252' } {
  // try utf8
  try {
    const utf8 = buf.toString('utf8');
    // crude heuristic: if replacement char appears excessively, try cp1252
    const bad = (utf8.match(/\uFFFD/g) || []).length;
    if (bad < 2) return { text: utf8, encoding: 'utf8' };
  } catch {}

  // fallback cp1252
  const decoded = iconv.decode(buf, 'windows-1252');
  return { text: decoded, encoding: 'win1252' };
}

