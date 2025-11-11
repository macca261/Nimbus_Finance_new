import iconv from 'iconv-lite';

export type SupportedEncoding = 'utf8' | 'latin1';

const REPLACEMENT_CHAR = '\uFFFD';

export function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n?/g, '\n');
}

export function tryDecodeBuffer(input: Buffer | string): { text: string; encoding: SupportedEncoding } {
  if (typeof input === 'string') {
    return { text: stripBom(normalizeLineEndings(input)), encoding: 'utf8' };
  }
  const utf8 = input.toString('utf8');
  if (!utf8.includes(REPLACEMENT_CHAR)) {
    return { text: stripBom(normalizeLineEndings(utf8)), encoding: 'utf8' };
  }
  const latin1 = iconv.decode(input, 'latin1');
  return { text: stripBom(normalizeLineEndings(latin1)), encoding: 'latin1' };
}

export function sniffDelimiter(lines: string[]): ';' | ',' | '\t' {
  const sample = lines.filter(l => l.trim().length > 0).slice(0, 10);
  const counts = { ';': 0, ',': 0, '\t': 0 };
  for (const line of sample) {
    counts[';'] += (line.match(/;/g) || []).length;
    counts[','] += (line.match(/,/g) || []).length;
    counts['\t'] += (line.match(/\t/g) || []).length;
  }
  if (counts[';'] >= counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts[','] >= counts['\t']) return ',';
  return '\t';
}

export function normalizeHeader(value: string): string {
  return value
    .replace(/^"+|"+$/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function parseEuroAmount(raw: string): number {
  let value = (raw ?? '').trim();
  if (!value) throw new Error('amount missing');
  if (value.endsWith('-')) value = '-' + value.slice(0, -1);
  value = value.replace(/[,]?00(?=\b)/, match => match); // keep trailing decimals format
  value = value.replace(/\s*eur$/i, '').replace(/\s*€$/, '');
  value = value.replace(/\s/g, '');
  value = value.replace(/\./g, '').replace(',', '.');
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error(`invalid amount "${raw}"`);
  return amount;
}

export function parseFlexibleDate(raw: string): string {
  const value = (raw ?? '').trim();
  if (!value) throw new Error('date missing');
  const german = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/;
  const germanMatch = german.exec(value);
  if (germanMatch) {
    const [, dd, mm, yyyy] = germanMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  const isoMatch = iso.exec(value);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  throw new Error(`unsupported date "${raw}"`);
}

export function findValue(record: Record<string, string>, candidates: string[]): string {
  const entries = Object.entries(record);
  for (const candidate of candidates) {
    const normCandidate = normalizeHeader(candidate);
    const hit = entries.find(([key]) => normalizeHeader(key) === normCandidate);
    if (hit) return hit[1] ?? '';
  }
  return '';
}
