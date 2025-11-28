import type { BankSignature, DetectionResult, DetectionScore } from './types';
import { ALL_SIGNATURES } from './bankSignatures';

export function detectBank(header: string[]): DetectionResult {
  const normalized = header.map(h => h.trim().toLowerCase());
  const scores: DetectionScore[] = [];

  for (const sig of ALL_SIGNATURES) {
    let score = 0;
    let matches = 0;
    for (const matcher of sig.headerMatchers) {
      if (normalized.some(h => matcher.pattern.test(h))) {
        score += matcher.weight;
        matches += 1;
      }
    }
    // Slight bonus for signatures with many matched fields
    if (matches >= 3) score += matches;
    scores.push({ signature: sig, score });
  }

  scores.sort((a, b) => b.score - a.score);

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[detectBank] header=', header);
    // eslint-disable-next-line no-console
    console.log('[detectBank] scores=', scores);
  }

  const best = scores[0];
  const threshold = 12;
  const signature = best && best.score >= threshold ? best.signature : null;

  return { signature, scores };
}


