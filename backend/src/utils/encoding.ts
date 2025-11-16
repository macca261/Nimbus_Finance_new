import { tryDecodeBuffer as tryDecodeBufferImpl } from '../parser/utils';

/**
 * Wrapper for tryDecodeBuffer that returns just the text string.
 * For compatibility with new parsing code.
 */
export function tryDecodeBuffer(buffer: Buffer): string {
  const result = tryDecodeBufferImpl(buffer);
  return result.text;
}

