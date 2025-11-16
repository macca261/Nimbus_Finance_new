import { normalizeHeader as normalizeHeaderImpl } from '../parser/utils';

/**
 * Re-export normalizeHeader for compatibility.
 */
export function normalizeHeader(value: string): string {
  return normalizeHeaderImpl(value);
}

