import { BankProfile, DetectResult, NormalizedTransaction } from '../types';
import { parseEuroAmount, parseFlexibleDate } from '../utils';
import { comdirectProfile } from './comdirect';
import { ingProfile } from './ing';
import { dkbProfile } from './dkb';
import { genericProfile } from './generic';

export const PROFILES: BankProfile[] = [comdirectProfile, ingProfile, dkbProfile, genericProfile];

export function scoreProfile(
  profile: BankProfile,
  headers: string[],
  rows: Record<string, string>[]
): DetectResult {
  const lcHeaders = headers.map((h) => h.toLowerCase());
  // 1) header token score
  let score = 0;
  const reasons: string[] = [];
  const hits = (profile.headerHints || []).filter((t) => lcHeaders.some((h) => h.includes(t)));
  score += (hits.length / (profile.headerHints?.length || 1)) * 0.7;
  if (!hits.length) reasons.push('no header hits');

  // 2) sanity check
  let ok = true;
  let reason = '';
  if (profile.sanityCheck) {
    const s = profile.sanityCheck(rows);
    ok = s.ok;
    reason = s.reason || '';
    if (!ok) reasons.push(`sanity: ${reason}`);
  }
  if (ok) score += 0.3;

  return { profileId: profile.id, confidence: Math.min(1, Math.max(0, score)), reasons };
}

export function normalizeRow(
  row: Record<string, string>,
  map: ReturnType<BankProfile['columnMap']>
): NormalizedTransaction {
  const date = map.bookedAt ? parseFlexibleDate(row[map.bookedAt]) : undefined;
  const vdate = map.valueDate ? parseFlexibleDate(row[map.valueDate]) : undefined;
  const amount = map.amount ? parseEuroAmount(row[map.amount]) : 0;
  const currency = map.currency ? row[map.currency] || 'EUR' : 'EUR';

  return {
    bookedAt: date || new Date().toISOString().slice(0, 10),
    valueDate: vdate,
    amount,
    currency,
    counterpart: map.counterpart ? row[map.counterpart] : undefined,
    purpose: map.purpose ? row[map.purpose] : undefined,
    iban: map.iban ? row[map.iban]?.replace(/\s+/g, '') : undefined,
    bic: map.bic ? row[map.bic]?.replace(/\s+/g, '') : undefined,
    balanceAfter: map.balanceAfter
      ? Number((row[map.balanceAfter] || '').replace(/[^\d.-]/g, ''))
      : undefined,
    raw: row,
  };
}

