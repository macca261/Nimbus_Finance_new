import { parse as parseCsvSync } from 'csv-parse/sync';

import type { ParsedRow, ParseResult, DetectionCandidate } from '../types';
import { tryDecodeBuffer, normalizeHeader } from '../../parser/utils';

export const id = 'sparkasse' as const;

type RecordRow = Record<string, string>;

function normKey(key: string): string {
  return normalizeHeader(key);
}

function get(record: RecordRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const desired = normKey(candidate);
    for (const [key, value] of Object.entries(record)) {
      if (normKey(key) === desired) {
        return value ?? '';
      }
    }
  }
  return '';
}

function toIsoDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function parseMoneyToCents(raw?: string): number {
  if (!raw) return 0;
  let value = raw.replace(/\s|\u00A0|"/g, '');
  const negative = value.startsWith('-') || /^\(.*\)$/.test(value);
  value = value.replace(/[()]/g, '');

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma > lastDot) {
    value = value.replace(/\./g, '').replace(',', '.');
  }

  value = value.replace(/[^\d.+-]/g, '');
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return 0;
  const cents = Math.round(numeric * 100);
  return negative ? -Math.abs(cents) : Math.abs(cents);
}

export function detect(text: string): { hit: boolean; confidence: number } {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 10);

  for (const line of lines) {
    const hdr = line.replace(/"/g, '').replace(/\s+/g, '').toLowerCase();
    
    // Sparkasse-specific detection: look for distinctive header combinations
    // Key differentiators from Deutsche Bank:
    // 1. Sparkasse has "Buchungstext" (very common in Sparkasse exports)
    // 2. Sparkasse has "Umsatz" (not "Umsatz in EUR" like Deutsche Bank)
    // 3. Sparkasse has "Wertstellung" (value date field)
    // 4. Sparkasse has "Auftraggeber/Empfänger" with slash
    
    const hasBuchungstag = hdr.includes('buchungstag');
    const hasWertstellung = hdr.includes('wertstellung');
    const hasBuchungstext = hdr.includes('buchungstext');
    const hasVerwendungszweck = hdr.includes('verwendungszweck');
    const hasUmsatz = hdr.includes('umsatz') && !hdr.includes('umsatzineur');
    const hasBetrag = hdr.includes('betrag');
    const hasCounterparty = 
      hdr.includes('auftraggeber/empfänger') ||
      hdr.includes('auftraggeber/empfaenger') ||
      hdr.includes('auftraggeberempfänger');
    
    // Strong Sparkasse match: has Buchungstag, Wertstellung, Buchungstext, and Umsatz (not "Umsatz in EUR")
    if (hasBuchungstag && hasWertstellung && hasBuchungstext && hasUmsatz && hasCounterparty) {
      return { hit: true, confidence: 1 }; // Maximum confidence for distinctive Sparkasse header
    }
    
    // Good Sparkasse match: has core fields including Buchungstext (Sparkasse-specific)
    if (hasBuchungstag && hasBuchungstext && (hasUmsatz || hasBetrag) && hasCounterparty) {
      return { hit: true, confidence: 1 }; // High confidence for Sparkasse with Buchungstext
    }
    
    // Basic match: has core fields (but less specific, might match other banks)
    const hasCore =
      hasBuchungstag &&
      (hasUmsatz || hasBetrag) &&
      (hasVerwendungszweck || hasBuchungstext) &&
      hasCounterparty;

    if (hasCore) {
      // If it has Buchungstext, it's more likely Sparkasse
      if (hasBuchungstext) {
        return { hit: true, confidence: 0.95 };
      }
      return { hit: true, confidence: 0.90 };
    }
  }

  return { hit: false, confidence: 0 };
}

export function parse(fileBuffer: Buffer): ParseResult {
  const { text } = tryDecodeBuffer(fileBuffer);
  const detection = detect(text);

  if (!detection.hit) {
    return {
      profileId: id,
      confidence: 0,
      rows: [],
      warnings: ['Header nicht als Sparkasse-Export erkannt.'],
      candidates: [{ profileId: id, confidence: 0 }],
      openingBalance: undefined,
      closingBalance: undefined,
    };
  }

  const baseOptions = {
    columns: true,
    bom: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  } as const;

  const sanitizedText = text.replace(/\uFEFF/g, '');

  let records: RecordRow[] = [];
  try {
    records = parseCsvSync(sanitizedText, { ...baseOptions, delimiter: ';' }) as RecordRow[];
  } catch {
    records = parseCsvSync(sanitizedText, { ...baseOptions, delimiter: ',' }) as RecordRow[];
  }

  const rows: ParsedRow[] = [];

  records.forEach((record, index) => {
    const bookingDate = toIsoDate(get(record, ['Buchungstag']));
    if (!bookingDate) return;

    const valutaDate =
      toIsoDate(get(record, ['Wertstellung'])) ??
      bookingDate;

    const currency = (get(record, ['Waehrung', 'Währung']).trim() || 'EUR').toUpperCase();

    const amountRaw = get(record, ['Umsatz', 'Betrag', 'Betrag (EUR)']);
    const amountCents = parseMoneyToCents(amountRaw);
    if (amountCents === 0) return;

    const type = get(record, ['Buchungstext']).trim();
    const memo = get(record, ['Verwendungszweck']).trim();
    const counterpartyRaw = get(record, ['Auftraggeber/Empfänger', 'Auftraggeber/Empfaenger', 'Name']).trim();
    const counterparty = counterpartyRaw.length > 0 ? counterpartyRaw : null;
    const accountIbanRaw = get(record, ['IBAN']).trim();
    const accountIban = accountIbanRaw.length > 0 ? accountIbanRaw : null;

    const rawTextParts = [type, memo].filter(Boolean);
    const rawText = rawTextParts.join(' ') || 'Sparkasse';

    const raw: Record<string, unknown> = { __source: 'csv_sparkasse_de', __index: index };
    for (const [key, value] of Object.entries(record)) {
      raw[key] = value;
    }

    const direction: ParsedRow['direction'] = amountCents >= 0 ? 'in' : 'out';

    // Generate externalId: deterministic hash based on transaction attributes
    const externalIdBase = [
      id,
      bookingDate,
      amountCents,
      currency,
      type.slice(0, 64),
      memo.slice(0, 64),
      counterparty?.slice(0, 64) || '',
    ].join('|');
    let hash = 0;
    for (let i = 0; i < externalIdBase.length; i++) {
      const chr = externalIdBase.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    const externalId = `${id}-${bookingDate}-${Math.abs(hash)}`;

    rows.push({
      bookingDate,
      valutaDate,
      amountCents,
      currency,
      direction,
      accountIban,
      accountId: 'sparkasse:giro',
      counterparty,
      counterpartyIban: null,
      mcc: null,
      reference: null,
      externalId,
      rawText,
      raw,
    });
  });

  const candidates: DetectionCandidate[] = [{ profileId: id, confidence: detection.confidence }];

  return {
    profileId: id,
    confidence: detection.confidence,
    rows,
    warnings: [],
    candidates,
    openingBalance: undefined,
    closingBalance: undefined,
  };
}


