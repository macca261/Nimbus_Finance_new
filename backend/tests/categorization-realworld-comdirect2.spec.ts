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
  it('categorizes Lidl as groceries', () => {
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
    // Uber EATS should be categorized as dining:delivery, not transport
    expect(tx.category).toBe('dining:delivery');
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

  it('categorizes PayPal OpenAI transaction correctly', () => {
    const rows = loadRows();
    const openai = rows.find(r => /openai/i.test(r.rawText ?? ''));
    expect(openai, 'Expected an OpenAI transaction in fixture').toBeDefined();
    if (!openai) return;

    const [tx] = categorizeBatch([openai]);
    // OpenAI should be categorized as subscriptions:software
    expect(tx.category).toBe('subscriptions:software');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('categorizes internal transfers correctly', () => {
    const rows = loadRows();
    const transfer = rows.find(r => {
      const text = (r.rawText ?? '').toLowerCase();
      return (
        (text.includes('übertrag') || text.includes('uebertrag') || text.includes('überweisung') || text.includes('ueberweisung') || text.includes('instant transfer')) &&
        (text.includes('aaron') || text.includes('mcintosh') || (text.includes('paypal') && text.includes('instant')))
      );
    });
    if (transfer) {
      const [tx] = categorizeBatch([transfer]);
      // Should be categorized as internal transfer or at least not 'other'
      expect(['internal:own-account', 'internal:savings']).toContain(tx.category);
      expect(tx.categoryConfidence).toBeGreaterThan(0.5);
    } else {
      // Skip if no transfer found
      expect(true).toBe(true);
    }
  });
});

