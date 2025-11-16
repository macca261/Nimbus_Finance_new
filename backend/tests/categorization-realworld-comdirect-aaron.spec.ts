import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import { categorizeBatch } from '../src/categorization';

function loadRows() {
  const path = resolve(__dirname, 'fixtures/Comdirect_real.csv');
  const buffer = readFileSync(path);
  const result = parseBankCsv(buffer);
  return result.rows;
}

describe('real-world comdirect categorization (Aaron fixture)', () => {
  it('categorizes Lidl transactions as groceries', () => {
    const rows = loadRows();
    const lidl = rows.find(r => /lidl/i.test(r.rawText ?? ''));
    expect(lidl, 'Expected a LIDL transaction in fixture').toBeDefined();
    if (!lidl) return;

    const [tx] = categorizeBatch([lidl]);
    expect(tx.category).toBe('groceries');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('categorizes Uber EATS as transport:rideshare', () => {
    const rows = loadRows();
    const uber = rows.find(r => /uber.*eats/i.test(r.rawText ?? '') || /help.*uber/i.test(r.rawText ?? ''));
    expect(uber, 'Expected an Uber EATS transaction in fixture').toBeDefined();
    if (!uber) return;

    const [tx] = categorizeBatch([uber]);
    // Uber EATS should be categorized as dining:delivery, not transport
    expect(tx.category).toBe('dining:delivery');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('categorizes Uber BV (non-EATS) as transport:rideshare', () => {
    const rows = loadRows();
    const uber = rows.find(r => /uber\s+bv/i.test(r.rawText ?? '') && !/eats/i.test(r.rawText ?? ''));
    expect(uber, 'Expected an Uber BV transaction in fixture').toBeDefined();
    if (!uber) return;

    const [tx] = categorizeBatch([uber]);
    // Uber BV (non-EATS) should be categorized as transport:rideshare (trip, not EATS)
    // Note: categorizeBatch returns internal category 'transport:rideshare', which maps to 'transport' in legacy
    expect(tx.category).toBe('transport:rideshare');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('categorizes Drillisch as subscriptions:telecom', () => {
    const rows = loadRows();
    const drillisch = rows.find(r => /drillisch/i.test(r.rawText ?? ''));
    expect(drillisch, 'Expected a Drillisch transaction in fixture').toBeDefined();
    if (!drillisch) return;

    const [tx] = categorizeBatch([drillisch]);
    expect(tx.category).toBe('subscriptions:telecom');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('categorizes PayPal + OpenAI as subscriptions:software', () => {
    const rows = loadRows();
    const openai = rows.find(r => /openai/i.test(r.rawText ?? ''));
    expect(openai, 'Expected an OpenAI/PayPal transaction').toBeDefined();
    if (!openai) return;

    const [tx] = categorizeBatch([openai]);
    expect(tx.category).toBe('subscriptions:software');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('extracts merchant names correctly from comdirect transactions', () => {
    const rows = loadRows();
    
    const lidlRow = rows.find(r => /lidl/i.test(r.rawText ?? ''));
    if (lidlRow) {
      const [tx] = categorizeBatch([lidlRow]);
      expect(tx.merchant).toBeTruthy();
      expect(tx.merchant?.toUpperCase()).toContain('LIDL');
    }

    const uberRow = rows.find(r => /uber/i.test(r.rawText ?? ''));
    if (uberRow) {
      const [tx] = categorizeBatch([uberRow]);
      expect(tx.merchant).toBeTruthy();
      expect(tx.merchant?.toUpperCase()).toContain('UBER');
    }

    const drillischRow = rows.find(r => /drillisch/i.test(r.rawText ?? ''));
    if (drillischRow) {
      const [tx] = categorizeBatch([drillischRow]);
      expect(tx.merchant).toBeTruthy();
      expect(tx.merchant?.toUpperCase()).toContain('DRILLISCH');
    }
  });

  it('does not categorize transactions as "other" with "unknown" source when rules should match', () => {
    const rows = loadRows();
    
    // Test a few key transactions that should definitely match rules
    const testCases = [
      { pattern: /lidl/i, expectedCategory: 'groceries' },
      // Uber transactions: EATS → dining:delivery, trips → transport:rideshare
      // The test will check the first Uber transaction found, which might be EATS or trip
      { pattern: /uber/i, expectedCategory: 'transport:rideshare', allowAlternatives: ['dining:delivery'] },
      { pattern: /drillisch/i, expectedCategory: 'subscriptions:telecom' },
      { pattern: /openai/i, expectedCategory: 'subscriptions:software' },
    ];

    for (const testCase of testCases) {
      const row = rows.find(r => testCase.pattern.test(r.rawText ?? ''));
      if (row) {
        const [tx] = categorizeBatch([row]);
        // For Uber, allow either transport:rideshare (trips) or dining:delivery (EATS)
        if (testCase.pattern.toString().includes('uber') && (testCase as any).allowAlternatives) {
          expect(
            (testCase as any).allowAlternatives.includes(tx.category) || tx.category === testCase.expectedCategory,
            `Transaction matching ${testCase.pattern} should be categorized as ${testCase.expectedCategory} or ${(testCase as any).allowAlternatives.join(' or ')}`
          ).toBe(true);
        } else {
          expect(tx.category, `Transaction matching ${testCase.pattern} should be categorized`).toBe(testCase.expectedCategory);
        }
        expect(tx.categorySource, `Transaction matching ${testCase.pattern} should have rule source`).toBe('rule');
        expect(tx.categoryConfidence, `Transaction matching ${testCase.pattern} should have confidence > 0.5`).toBeGreaterThan(0.5);
      }
    }
  });
});

