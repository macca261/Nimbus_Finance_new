import { parse } from 'csv-parse/sync';

export type RawRecord = Record<string, string>;

export type ParsedTransaction = {
  date: string; // ISO yyyy-mm-dd for transport
  amount: number; // positive income, negative expense (EUR)
  description: string;
  merchant?: string;
  currency?: string;
  metadata?: Record<string, string>;
};

export type DetectResult = {
  bank: string;
  delimiter: string;
  mapRecord: (rec: RawRecord) => ParsedTransaction | null;
};

// German helpers
export function parseGermanNumber(value: string): number {
  if (value == null) return NaN;
  let raw = String(value).replace(/\u00A0/g, ' ').trim(); // normalize nbsp
  let negative = false;
  if (/\(.*\)/.test(raw)) negative = true; // accounting negative (1.234,56)
  if (raw.endsWith('-')) negative = true; // trailing minus style
  raw = raw.replace(/[€A-Za-z\s]/g, ''); // drop currency text and spaces
  raw = raw.replace(/\./g, '').replace(',', '.');
  raw = raw.replace(/-$/, '');
  const n = Number(raw);
  if (String(value).trim() === '') return NaN;
  if (Number.isNaN(n)) return NaN;
  return negative ? -Math.abs(n) : n;
}

export function parseGermanDate(value: string): string {
  const v = (value || '').trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // DD.MM.YYYY or D.M.YYYY or with 2-digit year
  const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return new Date(Date.UTC(y, mo - 1, d)).toISOString().slice(0, 10);
  }
  // Fallback: let Date try
  const t = new Date(v);
  if (!Number.isNaN(t.getTime())) return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())).toISOString().slice(0, 10);
  // Return empty to indicate invalid instead of throwing
  return '';
}

export function extractMerchant(text: string): string | undefined {
  const t = text.trim();
  // PayPal pattern: "PAYPAL *<Merchant>"
  const paypal = t.match(/PAYPAL\s*\*\s*([A-Z0-9\- ]{3,})/i);
  if (paypal) return paypal[1].trim();
  // Card payment patterns
  const card = t.match(/(?:POS|Kartenzahlung|KARTENZAHLUNG)\s+([A-ZÄÖÜa-zäöü0-9\-\&\.,\s]{3,})/i);
  if (card) return card[1].trim();
  // SEPA patterns (Überweisung/Lastschrift) often show creditor name at start
  const sepa = t.match(/^([A-ZÄÖÜa-zäöü0-9\-\&\.,\s]{3,}?)\s+(?:SEPA|Lastschrift|Ueberweisung|Überweisung)/i);
  if (sepa) return sepa[1].trim();
  // Fallback: take first token-like word group
  const token = t.match(/^([A-ZÄÖÜa-zäöü0-9\-\&\.]{3,}(?:\s+[A-ZÄÖÜa-zäöü0-9\-\&\.]{2,})?)/);
  return token ? token[1] : undefined;
}

function hasHeaders(headers: string[], required: string[]): boolean {
  const set = new Set(headers.map(h => h.toLowerCase()));
  return required.every(r => set.has(r.toLowerCase()));
}

function cleanCsvText(csvText: string): string {
  const lines = csvText.split(/\r?\n/);
  const headerTokens = [
    'Buchungstag', 'Buchungstext', 'Umsatz', 'Betrag',
    'Date', 'Amount', 'Payee', 'Wertstellung'
  ];
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l || !l.trim()) continue;
    const hit = headerTokens.every(t => {
      // Must contain at least "Buchungstag" and one of the value columns
      return true;
    });
    const lower = l.toLowerCase();
    if ((/buchungstag/i.test(l) && (/buchungstext/i.test(l) || /verwendungszweck/i.test(l))) || (/date/i.test(l) && (/amount/i.test(l) || /eur/i.test(l)))) {
      start = i; break;
    }
  }
  return lines.slice(start).join('\n');
}

// Individual bank mappers
const mappers: Array<{
  name: string;
  delimiter: string;
  headers: string[]; // indicative headers
  map: (rec: RawRecord) => ParsedTransaction | null;
}> = [
  {
    name: 'comdirect',
    delimiter: ';',
    headers: ['Buchungstag', 'Buchungstext'],
    map: (rec) => {
      const date = parseGermanDate(rec['Buchungstag']);
      if (!date) return null;
      const amountRaw = rec['Umsatz (EUR)'] ?? rec['Umsatz in EUR'] ?? rec['Umsatz in EUR'] ?? rec['Umsatz in Eur'];
      const amount = parseGermanNumber(amountRaw);
      if (Number.isNaN(amount)) return null;
      const description = rec['Buchungstext'] || '';
      const merchant = extractMerchant(description);
      return { date, amount, description, merchant, currency: 'EUR', metadata: rec };
    }
  },
  {
    name: 'Sparkasse',
    delimiter: ';',
    headers: ['Buchungstag', 'Valuta', 'Auftraggeber/Empfänger', 'Verwendungszweck', 'Betrag'],
    map: (rec) => {
      const date = parseGermanDate(rec['Buchungstag']);
      const amount = parseGermanNumber(rec['Betrag']);
      const party = rec['Auftraggeber/Empfänger'] || '';
      const purpose = rec['Verwendungszweck'] || '';
      const description = [party, purpose].filter(Boolean).join(' - ');
      const merchant = extractMerchant(`${party} ${purpose}`) || party || undefined;
      return { date, amount, description, merchant, currency: rec['Währung'] || 'EUR', metadata: rec };
    }
  },
  {
    name: 'N26',
    delimiter: ',',
    headers: ['Date', 'Payee', 'Transaction type', 'Amount (EUR)'],
    map: (rec) => {
      // N26 often uses YYYY-MM-DD already
      const date = rec['Date']?.match(/\d{4}-\d{2}-\d{2}/) ? rec['Date'].slice(0, 10) : parseGermanDate(rec['Date']);
      const amount = Number((rec['Amount (EUR)'] || rec['Amount']).replace(',', '.'));
      const description = rec['Reference'] || rec['Payee'] || '';
      const merchant = extractMerchant(`${rec['Payee'] || ''} ${rec['Reference'] || ''}`) || rec['Payee'];
      return { date, amount, description, merchant, currency: rec['Currency'] || 'EUR', metadata: rec };
    }
  },
  {
    name: 'ING',
    delimiter: ';',
    headers: ['Buchung', 'Wertstellung', 'Buchungstext', 'Betrag'],
    map: (rec) => {
      const date = parseGermanDate(rec['Buchung'] || rec['Wertstellung']);
      const amount = parseGermanNumber(rec['Betrag']);
      const description = rec['Buchungstext'] || '';
      const merchant = extractMerchant(description);
      return { date, amount, description, merchant, currency: rec['Währung'] || 'EUR', metadata: rec };
    }
  },
  {
    name: 'Deutsche Bank',
    delimiter: ';',
    headers: ['Buchungstag', 'Verwendungszweck', 'Betrag'],
    map: (rec) => {
      const date = parseGermanDate(rec['Buchungstag']);
      const amount = parseGermanNumber(rec['Betrag']);
      const description = rec['Verwendungszweck'] || '';
      const merchant = extractMerchant(description);
      return { date, amount, description, merchant, currency: rec['Währung'] || 'EUR', metadata: rec };
    }
  },
  // Extend later with DKB, Postbank, Revolut EU, etc.
];

export function detectFormat(csvTextInput: string): DetectResult {
  const csvText = cleanCsvText(csvTextInput);
  const headerLine = csvText.split(/\r?\n/).find(l => l.trim().length > 0) ?? '';
  const delimiterGuess = (headerLine.match(/;/g)?.length ?? 0) >= (headerLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const records = parse(csvText, { columns: true, skip_empty_lines: true, delimiter: delimiterGuess, bom: true, relax_column_count: true, relax_quotes: true, trim: true });
  const headers = Object.keys(records[0] ?? {}).map(h => h.trim());
  for (const mapper of mappers) {
    if (mapper.delimiter === delimiterGuess && hasHeaders(headers, mapper.headers)) {
      return { bank: mapper.name, delimiter: mapper.delimiter, mapRecord: mapper.map };
    }
  }
  // Fallback: try any mapper regardless of delimiter
  for (const mapper of mappers) {
    if (hasHeaders(headers, mapper.headers)) {
      return { bank: mapper.name, delimiter: delimiterGuess, mapRecord: mapper.map };
    }
  }
  // Generic parser fallback
  return {
    bank: 'generic',
    delimiter: delimiterGuess,
    mapRecord: (rec) => {
      const description = rec['Buchungstext'] || rec['Verwendungszweck'] || rec['Reference'] || rec['Payee'] || '';
      const merchant = extractMerchant(description);
      const rawDate = rec['Buchungstag'] || rec['Date'] || rec['Buchung'] || rec['Wertstellung'] || rec['Wertstellung (Valuta)'] || '';
      const rawAmount = rec['Umsatz (EUR)'] || rec['Betrag'] || rec['Amount (EUR)'] || rec['Amount'] || '0';
      const currency = rec['Währung'] || rec['Currency'] || 'EUR';
      const dateParsed = /\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : parseGermanDate(rawDate);
      if (!dateParsed) return null;
      let amount: number;
      try { amount = rawAmount.includes(',') || rawAmount.includes('.') ? parseGermanNumber(rawAmount) : Number(rawAmount); } catch { return null; }
      if (Number.isNaN(amount)) return null;
      return { date: dateParsed, amount, description, merchant, currency, metadata: rec };
    }
  };
}

export function parseTransactions(csvTextInput: string): { bank: string; transactions: ParsedTransaction[] } {
  const csvText = cleanCsvText(csvTextInput);
  const detection = detectFormat(csvText);
  const records: RawRecord[] = parse(csvText, { columns: true, skip_empty_lines: true, delimiter: detection.delimiter, bom: true, relax_column_count: true, relax_quotes: true, trim: true });
  const txs: ParsedTransaction[] = [];
  for (const rec of records) {
    try {
      const tx = detection.mapRecord(rec);
      if (tx) txs.push(tx);
    } catch {
      // skip invalid rows
    }
  }
  return { bank: detection.bank, transactions: txs };
}

export function parseGermanNumber(value: string): number {
  if (value == null) return NaN;
  let raw = String(value).replace(/\u00A0/g, ' ').trim();
  let negative = false;
  if (/\(.*\)/.test(raw)) negative = true;
  if (raw.endsWith('-')) negative = true;
  raw = raw.replace(/[€A-Za-z\s]/g, '');
  raw = raw.replace(/\./g, '').replace(',', '.');
  raw = raw.replace(/-$/, '');
  const n = Number(raw);
  if (String(value).trim() === '') return NaN;
  if (Number.isNaN(n)) return NaN;
  return negative ? -Math.abs(n) : n;
}

export function parseGermanDate(value: string): string {
  const v = (value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return new Date(Date.UTC(y, mo - 1, d)).toISOString().slice(0, 10);
  }
  const t = new Date(v);
  if (!Number.isNaN(t.getTime())) return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())).toISOString().slice(0, 10);
  return '';
}

function splitSemicolonLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ';' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map(p => p.trim());
}

export class GermanBankCSVParser {
  parseCSV(csvText: string): { transactions: ParsedTransaction[]; bank: string } {
    const bank = this.detectBank(csvText);
    switch (bank) {
      case 'comdirect':
        return { transactions: this.parseComdirect(csvText), bank };
      case 'sparkasse':
        return { transactions: this.parseSparkasse(csvText), bank };
      case 'n26':
        return { transactions: this.parseN26(csvText), bank };
      default:
        return { transactions: this.parseGeneric(csvText), bank: 'unknown' };
    }
  }

  private detectBank(csvText: string): string {
    if (csvText.includes('Umsätze Girokonto') && csvText.includes('Buchungstag')) return 'comdirect';
    if (csvText.includes('Umsatz-Kategorien') || csvText.includes('Buchungstext')) return 'sparkasse';
    if (csvText.includes('Account number') || csvText.includes('Booking Date')) return 'n26';
    return 'unknown';
  }

  private parseComdirect(csvText: string): ParsedTransaction[] {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const transactions: ParsedTransaction[] = [];
    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('"Buchungstag";"Wertstellung"') || lines[i].startsWith('Buchungstag;Wertstellung')) {
        dataStartIndex = i + 1;
        break;
      }
    }
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line === '""') continue;
      try {
        const cleanLine = line.replace(/\r/g, '');
        const parts = splitSemicolonLine(cleanLine).map(p => p.replace(/"/g, ''));
        if (parts.length >= 5) {
          const bookingDate = parts[0];
          const description = parts[3] || '';
          const amountStr = parts[4] || '0';
          const tx: ParsedTransaction = {
            date: parseGermanDate(bookingDate),
            amount: this.parseGermanAmount(amountStr),
            description,
            merchant: this.extractMerchantFromDescription(description),
            currency: 'EUR',
          };
          if (tx.date && !Number.isNaN(tx.amount)) transactions.push(tx);
        }
      } catch {
        continue;
      }
    }
    return transactions;
  }

  private parseGermanAmount(amountStr: string): number {
    let cleanAmount = amountStr
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const amount = parseFloat(cleanAmount);
    if (Number.isNaN(amount)) {
      const match = amountStr.match(/-?[\d.,]+/);
      return match ? this.parseGermanAmount(match[0]) : 0;
    }
    return amount;
  }

  private extractMerchantFromDescription(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('lidl')) return 'Lidl';
    if (lower.includes('uber')) return 'Uber';
    if (lower.includes('cursor')) return 'Cursor Software';
    if (lower.includes('paypal')) {
      const m = description.match(/Ihr Einkauf bei (.+?)( Ref\.|$)/i);
      return m ? m[1].trim() : 'PayPal';
    }
    if (lower.includes('amazon')) return 'Amazon';
    if (lower.includes('spotify')) return 'Spotify';
    if (lower.includes('netflix')) return 'Netflix';
    if (lower.includes('rewe')) return 'Rewe';
    if (lower.includes('aldi')) return 'Aldi';
    if (lower.includes('aral')) return 'Aral';
    if (lower.includes('shell')) return 'Shell';
    return 'Unknown';
  }

  private parseSparkasse(csvText: string): ParsedTransaction[] { return []; }
  private parseN26(csvText: string): ParsedTransaction[] { return []; }
  private parseGeneric(csvText: string): ParsedTransaction[] { return []; }
}

export function parseTransactions(csvTextInput: string): { bank: string; transactions: ParsedTransaction[] } {
  const parser = new GermanBankCSVParser();
  const { bank, transactions } = parser.parseCSV(csvTextInput);
  return { bank, transactions };
}


