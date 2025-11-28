import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';

export type BankFamily = 'GermanLegacy' | 'Neobank' | 'Brokerage' | 'PayPal';

export type NumberFormat = 'commaDecimal' | 'dotDecimal';

export interface BankSignature {
  id: string;
  family: BankFamily;
  displayName: string;
  headerMatchers: {
    pattern: RegExp;
    weight: number;
  }[];
  dateFormat: 'dd.MM.yyyy' | 'dd.MM.yy' | 'yyyy-MM-dd' | 'MM/dd/yyyy';
  numberFormat: NumberFormat;
  delimiterHint?: ';' | ',' | '\t';
  encodingHint?: 'utf8' | 'latin1';
}

export interface RawFileContext {
  encoding: 'utf8' | 'latin1';
  delimiter: string;
  header: string[];
  rows: string[][];
}

export interface ParseWarning {
  rowIndex: number;
  message: string;
}

export interface DetectionScore {
  signature: BankSignature;
  score: number;
}

export interface DetectionResult {
  signature: BankSignature | null;
  scores: DetectionScore[];
}

export interface ParseResult {
  bankSignature: BankSignature | null;
  transactions: CanonicalTransaction[];
  warnings: ParseWarning[];
  detection: DetectionResult;
  header: string[];
}


