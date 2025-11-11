/**
 * Helper functions for normalizing CSV data
 */

export function pick(row: Record<string,string>, keys: string[]): string {
  for (const k of keys) {
    const hit = Object.keys(row).find(h => h.trim().toLowerCase() === k.trim().toLowerCase());
    if (hit && row[hit]) return String(row[hit]).trim();
  }
  return '';
}

export function normalizeDate(d?: string, optional=false): string|undefined {
  if (!d) return optional ? undefined : ((): never => { throw new Error('date missing'); })();
  const t = d.replace(/\s+/g,'').replace(/\//g,'.');
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  throw new Error(`bad date: ${d}`);
}

export function normalizeAmount(a?: string): string {
  const s = (a||'').replace(/\./g,'').replace(',', '.').replace(/\s*EUR\s*$/i,'').trim();
  const s2 = s.endsWith('-') ? ('-' + s.slice(0,-1)) : s;
  const n = Number(s2);
  if (Number.isNaN(n)) throw new Error(`bad amount: ${a}`);
  return n.toFixed(2);
}

