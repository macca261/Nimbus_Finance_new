import type { ParseResult, DetectionCandidate } from '../parsing/types';

import { tryDecodeBuffer } from '../utils/encoding';

import { isPayPalCsvText, parsePayPalCsv } from './paypal';

import { detectComdirectCsv, parseComdirectCsv } from '../parsing/comdirect';

import { detectCommerzbankCsv, parseCommerzbankCsv } from '../parsing/commerzbank';

import { detectDeutscheBankCsv, parseDeutscheBankCsv } from '../parsing/deutscheBank';

import { detectDkbCsv, parseDkbCsv } from '../parsing/dkb';

import { detectIngCsv, parseIngCsv } from '../parsing/ing';

import { detectN26Csv, parseN26Csv } from '../parsing/n26';

import { detect as detectSparkasseDe, parse as parseSparkasseDe } from '../parsing/profiles/sparkasse_de';

export class ParseBankCsvError extends Error {
  hints: string[] = [];
  candidates: string[] = [];

  constructor(message: string, hints: string[] = [], candidates: string[] = []) {
    super(message);
    this.name = 'ParseBankCsvError';
    this.hints = hints;
    this.candidates = candidates;
  }
}

type BankDetector = (text: string) => DetectionCandidate | null;

type BankParser = (buffer: Buffer) => ParseResult;

interface BankProfile {

  profileId: string;

  detect: BankDetector;

  parse: BankParser;

}

// Bank profiles (non-PayPal)

const BANK_PROFILES: BankProfile[] = [

  {

    profileId: 'comdirect',

    detect: detectComdirectCsv,

    parse: parseComdirectCsv,

  },

  {

    profileId: 'commerzbank',

    detect: detectCommerzbankCsv,

    parse: parseCommerzbankCsv,

  },

  {

    profileId: 'deutsche_bank',

    detect: detectDeutscheBankCsv,

    parse: parseDeutscheBankCsv,

  },

  {

    profileId: 'dkb',

    detect: detectDkbCsv,

    parse: parseDkbCsv,

  },

  {

    profileId: 'ing',

    detect: detectIngCsv,

    parse: parseIngCsv,

  },

  {

    profileId: 'n26',

    detect: detectN26Csv,

    parse: parseN26Csv,

  },

  {

    profileId: 'sparkasse',

    detect: (text: string) => {
      const result = detectSparkasseDe(text);
      if (!result.hit) return null;
      return {
        profileId: 'sparkasse',
        confidence: result.confidence,
      };
    },

    parse: parseSparkasseDe,

  },

  // TODO: add Postbank, Volksbank/VR, etc.

];

export function parseBankCsv(buffer: Buffer, hintedBank?: string): ParseResult {

  const text = tryDecodeBuffer(buffer);

  // 1) PayPal first – uses its own robust detection

  if (isPayPalCsvText(text)) {

    return parsePayPalCsv(buffer);

  }

  // 2) Bank profile detection

  const candidates: DetectionCandidate[] = [];

  for (const profile of BANK_PROFILES) {

    const candidate = profile.detect(text);

    if (candidate && candidate.confidence > 0) {

      candidates.push(candidate);

    }

  }

  // If a bank is hinted, boost its confidence

  if (hintedBank) {

    const normalizedHint = hintedBank.toLowerCase().trim();

    const hinted = candidates.find(c => c.profileId.toLowerCase() === normalizedHint);

    if (hinted) {

      hinted.confidence = Math.max(hinted.confidence, 0.9);

      candidates.sort((a, b) => b.confidence - a.confidence);

    }

  }

  if (candidates.length === 0) {

    throw new ParseBankCsvError('Unsupported or undetected bank');

  }

  // Highest-confidence candidate wins

  candidates.sort((a, b) => b.confidence - a.confidence);

  const winner = candidates[0];

  const profile = BANK_PROFILES.find((p) => p.profileId === winner.profileId);

  if (!profile) {

    throw new ParseBankCsvError(

      `Detected bank profile "${winner.profileId}", aber kein Parser implementiert.`,

    );

  }

  const result = profile.parse(buffer);

  return {

    ...result,

    confidence: winner.confidence,

    candidates,

  };

}
