import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseBankCsv } from '../src/parser/parseBankCsv';
import { categorizeTransaction } from '../src/categorization';

function loadComdirectRows() {
  const path = resolve(__dirname, 'fixtures/Comdirect_real.csv');
  const buffer = readFileSync(path);
  const parsed = parseBankCsv(buffer);
  return parsed.rows;
}

describe('real-world comdirect categorization', () => {
  it('categorizes supermarket Lidl as groceries', () => {
    const rows = loadComdirectRows();
    const target = rows.find(r => /lidl/i.test(r.rawText || ''));

    expect(target).toBeDefined();
    if (!target) return;

    const tx = categorizeTransaction(target);

    expect(tx.category).toBe('groceries');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('categorizes Uber as transport:rideshare', () => {
    const rows = loadComdirectRows();
    const target = rows.find(r => /uber/i.test(r.rawText || '') && !/uber.*eats/i.test(r.rawText || ''));

    expect(target).toBeDefined();
    if (!target) return;

    const tx = categorizeTransaction(target);

    expect(tx.category).toBe('transport:rideshare');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('categorizes Uber EATS as transport:rideshare', () => {
    const rows = loadComdirectRows();
    const target = rows.find(r => /uber.*eats/i.test(r.rawText || ''));

    expect(target).toBeDefined();
    if (!target) return;

    const tx = categorizeTransaction(target);

    expect(tx.category).toBe('transport:rideshare');
    expect(tx.categorySource).toBe('rule');
  });

  it('extracts reasonable merchant names from comdirect transactions', () => {
    const rows = loadComdirectRows();
    
    const lidlRow = rows.find(r => /lidl/i.test(r.rawText || ''));
    if (lidlRow) {
      const tx = categorizeTransaction(lidlRow);
      expect(tx.merchant).toBeTruthy();
      expect(tx.merchant?.toUpperCase()).toContain('LIDL');
    }

    const uberRow = rows.find(r => /uber/i.test(r.rawText || ''));
    if (uberRow) {
      const tx = categorizeTransaction(uberRow);
      expect(tx.merchant).toBeTruthy();
      expect(tx.merchant?.toUpperCase()).toContain('UBER');
    }

    const drillischRow = rows.find(r => /drillisch/i.test(r.rawText || ''));
    if (drillischRow) {
      const tx = categorizeTransaction(drillischRow);
      expect(tx.merchant).toBeTruthy();
      expect(tx.merchant?.toUpperCase()).toContain('DRILLISCH');
    }
  });

  it('categorizes Drillisch as subscriptions:telecom', () => {
    const rows = loadComdirectRows();
    const target = rows.find(r => /drillisch/i.test(r.rawText || ''));

    expect(target).toBeDefined();
    if (!target) return;

    const tx = categorizeTransaction(target);

    expect(tx.category).toBe('subscriptions:telecom');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('categorizes REWE from comdirect_old.csv as groceries', () => {
    const path = resolve(__dirname, 'fixtures/comdirect_old.csv');
    const buffer = readFileSync(path);
    const parsed = parseBankCsv(buffer);
    const target = parsed.rows.find(r => /rewe/i.test(r.rawText || ''));

    expect(target).toBeDefined();
    if (!target) return;

    const tx = categorizeTransaction(target);

    expect(tx.category).toBe('groceries');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });

  it('categorizes GEHALT from comdirect_old.csv as income:salary', () => {
    const path = resolve(__dirname, 'fixtures/comdirect_old.csv');
    const buffer = readFileSync(path);
    const parsed = parseBankCsv(buffer);
    const target = parsed.rows.find(r => /gehalt/i.test(r.rawText || ''));

    expect(target).toBeDefined();
    if (!target) return;

    const tx = categorizeTransaction(target);

    expect(tx.category).toBe('income:salary');
    expect(tx.categorySource).toBe('rule');
    expect(tx.categoryConfidence).toBeGreaterThan(0.5);
  });
});

