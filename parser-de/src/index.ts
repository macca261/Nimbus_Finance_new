import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { XMLParser } from 'fast-xml-parser';

function hasUtf8Bom(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}
function countReplacementChars(text: string): number {
  let c = 0; for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 0xfffd) c++; return c;
}
function detectEncoding(buffer: Buffer): 'utf8' | 'utf8-bom' | 'cp1252' | 'latin1' {
  if (hasUtf8Bom(buffer)) return 'utf8-bom';
  const utf8 = buffer.toString('utf8');
  if (countReplacementChars(utf8) === 0) return 'utf8';
  for (let i = 0; i < buffer.length; i++) { const b = buffer[i]; if (b >= 0x80 && b <= 0x9f) return 'cp1252'; }
  return 'latin1';
}
function toUtf8(buffer: Buffer): string {
  const enc = detectEncoding(buffer);
  if (enc === 'utf8-bom') return buffer.slice(3).toString('utf8');
  if (enc === 'utf8') return buffer.toString('utf8');
  if (enc === 'cp1252') return iconv.decode(buffer, 'windows-1252');
  return iconv.decode(buffer, 'latin1');
}

function normalizeAnyDate(input: string): string | undefined {
  if (!input) return undefined; const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (m) return `${m[3]}-${String(+m[2]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/); if (m) return `${2000+ +m[3]}-${String(+m[2]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;
  return undefined;
}
function normalizeGermanNumber(input: string): number {
  if (input == null) return NaN; let s = String(input).trim(); if (!s) return NaN;
  const neg = /\(.*\)|-$/.test(s); s = s.replace(/[€A-Za-z\u00A0\s]/g,'').replace(/[.']/g,'').replace(/,(\d{1,})$/,'.$1').replace(/-$/,'');
  const n = Number(s); return neg ? -Math.abs(n) : n;
}

function detectDelimiter(sample: string): string {
  const first = sample.split(/\r?\n/).find(l => l.trim().length>0) || '';
  const sc = (first.match(/;/g)||[]).length; const cc = (first.match(/,/g)||[]).length; return sc >= cc ? ';' : ',';
}

function csvToCanonical(text: string): { adapterId: string; canonical: any[] } {
  const delimiter = detectDelimiter(text);
  const rows: any[] = parse(text, { columns: true, skip_empty_lines: true, delimiter, bom: true, relax_quotes: true, relax_column_count: true, trim: true });
  if (!rows.length) return { adapterId: 'csv.generic', canonical: [] };
  const headers = Object.keys(rows[0]);
  const has = (h: string) => headers.some(x => x.toLowerCase() === h.toLowerCase());
  let adapterId = 'csv.generic';
  if (has('Buchungstag') && has('Betrag')) adapterId = 'de.sparkasse.csv';
  else if (has('Buchung') && has('Wertstellung')) adapterId = 'de.ing.csv';
  else if (has('Date') && has('Amount')) adapterId = 'n26.csv';
  const canonical = rows.map((r) => {
    const booking = r['Buchungstag'] || r['Buchung'] || r['Date'] || r['Booking Date'] || r['Completed Date'];
    const value = r['Valutadatum'] || r['Wertstellung'] || r['Value Date'];
    const amountRaw = r['Betrag'] || r['Amount'] || r['Amount (EUR)'] || r['Umsatz (EUR)'] || r['Umsatz in EUR'];
    const currency = r['Währung'] || r['Currency'] || 'EUR';
    const name = r['Auftraggeber/Empfänger'] || r['Payee'] || r['Name'] || r['Name Zahlungsbeteiligter'];
    const purpose = r['Verwendungszweck'] || r['Buchungstext'] || r['Description'] || r['Reference'];
    return {
      booking_date: normalizeAnyDate(String(booking)) || String(booking || ''),
      value_date: value ? normalizeAnyDate(String(value)) : undefined,
      amount: normalizeGermanNumber(String(amountRaw ?? '0')),
      currency,
      purpose,
      counterpart_name: name,
    };
  }).filter(c => c.booking_date && !Number.isNaN(c.amount));
  return { adapterId, canonical };
}

function camtToCanonical(xml: string): { adapterId: string; canonical: any[] } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const obj = parser.parse(xml);
  const doc = obj?.Document?.BkToCstmrStmt ?? obj?.Document?.BkToCstmrAcctRpt;
  const stmts = Array.isArray(doc?.Stmt) ? doc.Stmt : doc?.Stmt ? [doc.Stmt] : [];
  const canonical: any[] = [];
  for (const stmt of stmts) {
    const ntries = Array.isArray(stmt.Ntry) ? stmt.Ntry : stmt.Ntry ? [stmt.Ntry] : [];
    for (const n of ntries) {
      const bkDate = n.BookgDt?.Dt ?? n.BookgDt?.DtTm ?? n.ValDt?.Dt ?? n.ValDt?.DtTm;
      const amtNode = n.Amt; const amt = typeof amtNode === 'object' ? Number(amtNode['#text'] ?? amtNode.text ?? amtNode.value) : Number(amtNode);
      const ccy = typeof amtNode === 'object' ? (amtNode.ccy || amtNode.Ccy) : undefined;
      const purpose = n?.NtryDtls?.TxDtls?.RmtInf?.Ustrd;
      const booking = normalizeAnyDate(String(bkDate));
      if (booking && !Number.isNaN(amt)) canonical.push({ booking_date: booking, amount: amt, currency: ccy, purpose });
    }
  }
  return { adapterId: 'camt.053', canonical };
}

export async function parseBufferAuto(buf: Buffer, _opts: { accountId: string }): Promise<{ adapterId: string; canonical: any[] }> {
  const text = toUtf8(buf);
  if (/^<\?xml/i.test(text)) return camtToCanonical(text);
  return csvToCanonical(text);
}


