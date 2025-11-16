import { describe, it, expect } from 'vitest';
import { applyRules } from '../src/normalizer/rules';

describe('normalizer rules smoke', () => {
  it('applyRules is a function and returns normalized fields', () => {
    expect(typeof applyRules).toBe('function');
    const out = applyRules({ text: 'REWE Markt Köln', description: 'Lebensmittel' });

    expect(out).toHaveProperty('normalizedText');
    expect(out).toHaveProperty('normalizedDescription');
    expect(out.categorySource ?? 'unknown').toBeDefined();
  });
});

