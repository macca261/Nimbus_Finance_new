// Central parser entrypoint & type exports

export { parseBankCsv } from './parseBankCsv';
export { isPayPalCsvText, parsePayPalCsv, PayPalParseError } from './paypal';

export type { BankProfile } from './types';
export type { ParseResult, ParsedRow, ParseCandidate as DetectionCandidate } from '../parsing/types';
