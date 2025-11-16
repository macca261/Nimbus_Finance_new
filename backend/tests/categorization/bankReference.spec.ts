import { describe, expect, it } from 'vitest';
import { stripBankReference } from '../../src/categorization/textPreprocessor';

describe('stripBankReference', () => {
  it('extracts bank reference ID from comdirect-style text', () => {
    const input = 'Uber BV, Ihr Einkauf bei Uber BV Ref. 6P2C21RY16B438RD/48368';
    const result = stripBankReference(input);
    
    expect(result.bankReferenceId).toBe('6P2C21RY16B438RD/48368');
    expect(result.cleanText).toBe('Uber BV, Ihr Einkauf bei Uber BV');
  });

  it('handles text without Ref. pattern', () => {
    const input = 'Uber BV, Ihr Einkauf bei Uber BV';
    const result = stripBankReference(input);
    
    expect(result.bankReferenceId).toBeNull();
    expect(result.cleanText).toBe('Uber BV, Ihr Einkauf bei Uber BV');
  });

  it('handles Ref without period', () => {
    const input = 'Transaction Ref 6P2C21RY16B438RD/48368';
    const result = stripBankReference(input);
    
    expect(result.bankReferenceId).toBe('6P2C21RY16B438RD/48368');
    expect(result.cleanText).toBe('Transaction');
  });

  it('handles lowercase ref', () => {
    const input = 'Transaction ref. 6P2C21RY16B438RD/48368';
    const result = stripBankReference(input);
    
    expect(result.bankReferenceId).toBe('6P2C21RY16B438RD/48368');
    expect(result.cleanText).toBe('Transaction');
  });

  it('cleans up extra whitespace after removal', () => {
    const input = 'Transaction  Ref. 6P2C21RY16B438RD/48368  More text';
    const result = stripBankReference(input);
    
    expect(result.bankReferenceId).toBe('6P2C21RY16B438RD/48368');
    expect(result.cleanText).toBe('Transaction More text');
  });
});

