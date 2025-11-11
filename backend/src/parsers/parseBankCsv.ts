import { readCsv } from './csv';
import { PROFILES, scoreProfile, normalizeRow } from './profiles';
import { BankProfile, NormalizedTransaction } from './types';

export function detectBankProfile(
  records: string[][],
  headers: string[]
): { profileId: string; confidence: number; reasons: string[] } {
  // keep signature for future; actual scoring done in parseBankCsv
  const res = PROFILES.map((p) => scoreProfile(p, headers, [])).sort((a, b) => b.confidence - a.confidence)[0];
  return { profileId: res.profileId, confidence: res.confidence, reasons: res.reasons };
}

export function parseBankCsv(input: Buffer | string): {
  profileId: string;
  confidence: number;
  transactions: NormalizedTransaction[];
  warnings: string[];
  tried: any[];
} {
  console.info('[parseBankCsv] starting parse');
  
  // first read raw and optionally preprocess per-profile for preambles
  const first = readCsv(input);
  console.info('[parseBankCsv] detected encoding/delimiter:', first.delimiter, 'header line index:', first.headerLineIndex);
  const variants = PROFILES.map((p) => {
    const lines = p.preprocess ? p.preprocess(first.rawLines.slice()) : first.rawLines.slice();
    const copy = readCsv(lines.join('\n'));
    const score = scoreProfile(p, copy.headers, copy.rows);
    return { profile: p, csv: copy, score };
  }).sort((a, b) => b.score.confidence - a.score.confidence);

  const best = variants[0];
  const tried = variants.map((v) => ({
    profileId: v.profile.id,
    confidence: v.score.confidence,
    reasons: v.score.reasons,
    headers: v.csv.headers,
    delimiter: v.csv.delimiter,
    headerLineIndex: v.csv.headerLineIndex,
  }));

  console.info('[parseBankCsv] tried profiles:', tried.map((t) => `${t.profileId} (${(t.confidence * 100) | 0}%): ${t.reasons.join('; ') || 'ok'}`).join(' | '));

  if (!best || best.score.confidence < 0.35) {
    const hints = tried.map((t) => `${t.profileId} (${(t.confidence * 100) | 0}%: ${t.reasons.join('; ') || 'ok'})`).join(' | ');
    const err: any = new Error(`Unsupported or undetected bank. Tried: ${hints}`);
    err.hints = [hints];
    err.tried = tried;
    err.triedProfiles = tried;
    throw err;
  }

  console.info('[parseBankCsv] chosen profile:', best.profile.id, `confidence: ${(best.score.confidence * 100) | 0}%`);
  console.info('[parseBankCsv] delimiter:', best.csv.delimiter, 'header line index:', best.csv.headerLineIndex);

  const map = best.profile.columnMap(best.csv.headers);
  const txs = best.csv.rows
    .map((r) => {
      const cleaned = best.profile.parseRow ? best.profile.parseRow(r) : r;
      return normalizeRow(cleaned, map);
    })
    .filter((tx) => tx.bookedAt && !Number.isNaN(tx.amount));

  console.info('[parseBankCsv] completed parse:', txs.length, 'transactions');
  
  return {
    profileId: best.profile.id,
    confidence: best.score.confidence,
    transactions: txs,
    warnings: [],
    tried,
  };
}

