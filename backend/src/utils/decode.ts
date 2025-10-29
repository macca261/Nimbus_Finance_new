import iconv from 'iconv-lite';

export function decodeCsvBuffer(buf: Buffer): string {
  // Try UTF-8 first
  let text = buf.toString('utf8');
  // Heuristic: if too few separators or many replacement chars, try cp1252
  const header = text.split(/\r?\n/)[0] || '';
  const badChars = (text.match(/\uFFFD/g) || []).length; // replacement char
  const sepCount = (header.match(/[;,]/g) || []).length;
  if (badChars > 0 || sepCount < 1) {
    try {
      text = iconv.decode(buf, 'win1252');
    } catch {
      try { text = iconv.decode(buf, 'latin1'); } catch { /* ignore */ }
    }
  }
  return text;
}


