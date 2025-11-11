import type { Direction } from '../../parsing/types';
import { normalizeHeader, parseEuroAmount, parseFlexibleDate } from '../utils';

export function valueFor(record: Record<string, string>, candidates: string[]): string {
  const entries = Object.entries(record);
  for (const candidate of candidates) {
    const normCandidate = normalizeHeader(candidate);
    const match = entries.find(([key]) => normalizeHeader(key) === normCandidate);
    if (match) return match[1] ?? '';
  }
  return '';
}

export function valueByIncludes(record: Record<string, string>, candidates: string[]): string {
  const entries = Object.entries(record);
  for (const candidate of candidates) {
    const normCandidate = normalizeHeader(candidate);
    const match = entries.find(([key]) => normalizeHeader(key).includes(normCandidate));
    if (match) return match[1] ?? '';
  }
  return '';
}

export function toAmountCents(raw: string): number {
  const amount = parseEuroAmount(raw);
  return Math.round(amount * 100);
}

export function toBookingDate(raw: string): string {
  return parseFlexibleDate(raw);
}

export function inferDirection(amountCents: number): Direction {
  return amountCents >= 0 ? 'in' : 'out';
}

export function buildRawText(record: Record<string, string>, fields: string[]): string {
  const parts = fields
    .map(field => record[field])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (parts.length > 0) return parts.join(' | ');
  return Object.values(record)
    .map(value => value?.trim())
    .filter((value): value is string => !!value)
    .join(' | ');
}

export function headerScore(headers: string[], keywords: string[]): number {
  const normalized = headers.map(normalizeHeader);
  let score = 0;
  for (const keyword of keywords) {
    if (normalized.some(h => h.includes(keyword))) {
      score += 1;
    }
  }
  return score / Math.max(1, keywords.length);
}


