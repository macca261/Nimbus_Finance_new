import { stripBOM, normalizeCRLF, sniffDelimiter, tryDecode } from './utils';

export type CsvResult = {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
  rawLines: string[];
  headerLineIndex: number;
};

export function readCsv(input: Buffer | string): CsvResult {
  const text = typeof input === 'string' ? input : tryDecode(input);
  const clean = stripBOM(normalizeCRLF(text));
  const rawLines = clean.split('\n').filter((l) => l.length > 0);

  // find header line: prefer one that includes typical tokens (Buchungstag, Betrag, Umsatz)
  const headerIdx = rawLines.findIndex((l) => /(buchung|betrag|umsatz|wertstellung|valuta)/i.test(l));
  const headerLine = headerIdx >= 0 ? rawLines[headerIdx] : rawLines[0];

  const sample = rawLines.slice(headerIdx >= 0 ? headerIdx : 0, (headerIdx >= 0 ? headerIdx : 0) + 3).join('\n');
  const delimiter = sniffDelimiter(sample);

  const headers = splitCsvLine(headerLine, delimiter).map((h) => h.trim());

  const rows: Record<string, string>[] = [];
  for (let i = headerIdx >= 0 ? headerIdx + 1 : 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    // stop on empty lines
    if (!line.trim()) continue;
    const cols = splitCsvLine(line, delimiter);
    if (cols.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return { headers, rows, delimiter, rawLines, headerLineIndex: headerIdx >= 0 ? headerIdx : 0 };
}

// simple CSV split supporting quotes
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (!q && c === delim) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

