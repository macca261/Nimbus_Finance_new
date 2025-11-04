export type HeaderShape =
  | 'generic_de'
  | 'comdirect_giro'
  | 'generic_simple'
  | 'unknown';

/** Detect delimiter (prefer semicolon if present) */
export function detectDelimiter(line: string): ';' | ',' {
  // prefer ; if present
  if (line.includes(';')) return ';';
  return ',';
}

export function detectHeaderShape(cols: string[]): HeaderShape {
  const c = cols.map(s => s.trim().toLowerCase());

  const has = (name: string) => c.includes(name);

  // comdirect giro
  if (has('buchungstag') && has('wertstellung (valuta)') && has('buchungstext') && (has('umsatz in eur') || has('umsatz'))) {
    return 'comdirect_giro';
  }

  // generic german
  const genericHits =
    (has('datum') || has('buchungstag')) &&
    (has('wertstellung') || has('valuta') || has('wertstellung (valuta)')) &&
    (has('verwendungszweck') || has('buchungstext') || has('text')) &&
    (has('betrag') || has('umsatz') || has('umsatz in eur'));
  if (genericHits) return 'generic_de';

  // simple test sample: bookingDate,valueDate,amountCents,currency,purpose
  const simple = ['bookingdate', 'valuedate', 'amountcents', 'currency', 'purpose'];
  const matchSimple = simple.every(k => c.includes(k));
  if (matchSimple) return 'generic_simple';

  return 'unknown';
}

function splitHeaderLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ';' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.map(s => s.replace(/^"+|"+$/g, '').trim());
}

/** returns index of header row; scans first 30 lines */
export function findHeaderIndex(lines: string[]): { headerIdx: number; shape: HeaderShape; columns: string[]; delim: ';' | ',' } | null {
  const maxScan = Math.min(lines.length, 30);
  let firstNonEmpty: { idx: number; cols: string[]; delim: ';' | ',' } | null = null;
  
  for (let i = 0; i < maxScan; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const delim = detectDelimiter(raw);
    const cols = raw.split(delim).map(s => s.replace(/^"+|"+$/g, '').trim());
    
    // Remember first non-empty line as potential header
    if (!firstNonEmpty && cols.length >= 3) {
      firstNonEmpty = { idx: i, cols, delim };
    }
    
    const shape = detectHeaderShape(cols);
    if (shape !== 'unknown') {
      return { headerIdx: i, shape, columns: cols, delim };
    }
  }
  
  // Fallback: return first non-empty line if we found one, treat as unknown shape
  if (firstNonEmpty) {
    return { headerIdx: firstNonEmpty.idx, shape: 'unknown', columns: firstNonEmpty.cols, delim: firstNonEmpty.delim };
  }
  
  return null;
}


