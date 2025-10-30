import iconv from 'iconv-lite';

export type SupportedEncoding = 'utf8' | 'utf8-bom' | 'cp1252' | 'iso-8859-1';

function hasUtf8Bom(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

function countReplacementChars(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0xfffd) count++;
  }
  return count;
}

export function detectEncoding(buffer: Buffer): SupportedEncoding {
  if (hasUtf8Bom(buffer)) return 'utf8-bom';

  // Try UTF-8
  const utf8 = buffer.toString('utf8');
  if (countReplacementChars(utf8) === 0) return 'utf8';

  // Heuristic: If bytes in 0x80..0x9F exist, prefer cp1252 over iso-8859-1 for German CSVs
  let hasExtended = false;
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    if (b >= 0x80 && b <= 0x9f) {
      hasExtended = true;
      break;
    }
  }
  return hasExtended ? 'cp1252' : 'iso-8859-1';
}

export function toUtf8(buffer: Buffer): string {
  const enc = detectEncoding(buffer);
  if (enc === 'utf8-bom') {
    // Strip BOM
    const sliced = buffer.slice(3);
    return sliced.toString('utf8');
  }
  if (enc === 'utf8') return buffer.toString('utf8');
  if (enc === 'cp1252') return iconv.decode(buffer, 'windows-1252');
  return iconv.decode(buffer, 'latin1'); // iso-8859-1
}


