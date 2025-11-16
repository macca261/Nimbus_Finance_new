import { describe, it, expect } from 'vitest';
import { applyRules, applyRulesForRow, applyBasicRules } from '../src/categorization/rules';

describe('rules export contract', () => {
  it('applyRules is a function', () => {
    expect(typeof applyRules).toBe('function');
  });

  it('applyRulesForRow is a function', () => {
    expect(typeof applyRulesForRow).toBe('function');
  });

  it('applyBasicRules is a function', () => {
    expect(typeof applyBasicRules).toBe('function');
  });
});

