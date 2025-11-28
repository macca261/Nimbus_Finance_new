import { parse } from 'date-fns';

function safeTrim(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function cleanText(value: string | null | undefined): string {
  return safeTrim(value).replace(/\s+/g, ' ').trim();
}

export function parseGermanDate(value: string): string {
  const trimmed = cleanText(value);
  if (!trimmed) throw new Error('Empty date');
  const formats = ['dd.MM.yyyy', 'dd.MM.yy'];
  for (const format of formats) {
    try {
      const parsed = parse(trimmed, format, new Date());
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    } catch {
      // continue
    }
  }
  throw new Error(`Unsupported German date: ${value}`);
}

export function parseIsoDate(value: string): string {
  const trimmed = cleanText(value);
  if (!trimmed) throw new Error('Empty date');
  const iso = new Date(trimmed);
  if (Number.isNaN(iso.getTime())) throw new Error(`Invalid ISO date: ${value}`);
  return iso.toISOString().slice(0, 10);
}

export function parseAmount(raw: string, format: 'commaDecimal' | 'dotDecimal'): number {
  const text = cleanText(raw);
  if (!text) throw new Error('Empty amount');
  const normalized =
    format === 'commaDecimal'
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) throw new Error(`Invalid amount: ${raw}`);
  return Math.round(value * 100);
}


