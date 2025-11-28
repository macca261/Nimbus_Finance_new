import type { BankParser } from '../parserTypes';
import { LegacyGermanParser } from './legacyGermanParser';
import { NeobankParser } from './neobankParser';
import { PayPalParser } from './paypalParser';

export const PARSERS: BankParser[] = [
  new LegacyGermanParser(),
  new NeobankParser(),
  new PayPalParser(),
];


