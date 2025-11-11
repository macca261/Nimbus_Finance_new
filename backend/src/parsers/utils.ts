export function stripBOM(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export function normalizeCRLF(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function sniffDelimiter(sample: string): string {
  // prefer semicolon if it appears a lot; else comma
  const semi = (sample.match(/;/g) || []).length;
  const comma = (sample.match(/,/g) || []).length;
  return semi > comma ? ';' : ',';
}

export function tryDecode(buf: Buffer): string {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  // fall back to latin1 if replacement chars present
  return Buffer.from(buf.toString('binary'), 'binary').toString('latin1');
}

// 1.234,56  | -66,99 | 29 -> number
export function parseEuroAmount(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim();
  s = s.replace(/\s/g, '');
  // remove currency suffix/prefix
  s = s.replace(/EUR$/i, '').replace(/^EUR/i, '').trim();
  // thousands dots to nothing, decimal comma -> dot
  s = s.replace(/\./g, '').replace(/,/, '.');
  // trailing minus (e.g., 123,45-) -> -123.45
  if (s.endsWith('-')) s = '-' + s.slice(0, -1);
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Invalid amount: ${raw}`);
  return n;
}

// DD.MM.YYYY or YYYY-MM-DD
export function parseFlexibleDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return undefined;
}

export function toLowerHeaders(headers: string[]): string[] {
  return headers.map((h) => h.trim().toLowerCase());
}

