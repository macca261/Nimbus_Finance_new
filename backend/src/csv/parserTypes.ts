import type { CanonicalTransaction } from '@nimbus/shared/src/types/canonical';
import type { BankSignature } from './types';

export interface ParserContext {
  signature: BankSignature;
  header: string[];
  rows: string[][];
}

export interface BankParser {
  canHandle(signature: BankSignature): boolean;
  parse(ctx: ParserContext): CanonicalTransaction[];
}


