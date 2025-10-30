/**
 * Normalize many common date formats to ISO (YYYY-MM-DD).
 * Supports: DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD.
 */
export function normalizeAnyDate(input: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();

  // YYYY-MM-DD already ISO
  const isoMatch = s.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) return s;

  // DD.MM.YYYY
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const [_, d, mo, y] = m;
    return `${pad2(Number(y))}-${pad2(Number(mo))}-${pad2(Number(d))}`;
  }

  // DD.MM.YY (assume 2000-2099)
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (m) {
    const [_, d, mo, yy] = m;
    const y = Number(yy) + 2000;
    return `${pad2(y)}-${pad2(Number(mo))}-${pad2(Number(d))}`;
  }

  return undefined;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}


