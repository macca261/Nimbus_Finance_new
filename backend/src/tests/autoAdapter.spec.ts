import { describe, it, expect } from 'vitest';
import { buildHeuristicAdapter } from '../ingest/autoAdapter';

describe('AutoMapper v1', () => {
  it('Sparkasse-like headers', () => {
    const headers = ['Buchungstag','Valutadatum','Betrag','Währung','Verwendungszweck','Auftraggeber/Empfänger'];
    const sample = { Betrag: '-12,34' } as any;
    const { adapter, coverage } = buildHeuristicAdapter(headers, sample);
    expect(adapter.id).toBe('auto_csv_v1');
    expect(coverage).toBeGreaterThanOrEqual(0.66);
    expect(adapter.map.amount).toMatchObject({ col: 'Betrag', locale: 'de-DE' });
  });
  it('DKB-like headers with dot decimals', () => {
    const headers = ['Buchungstag','Wertstellung','Betrag (EUR)','Währung','Verwendungszweck'];
    const sample = { 'Betrag (EUR)': '-12.34' } as any;
    const { adapter } = buildHeuristicAdapter(headers, sample);
    expect(adapter.map.amount).toMatchObject({ col: 'Betrag (EUR)' });
  });
  it('Revolut-like credit/debit', () => {
    const headers = ['Completed Date','Paid out (EUR)','Paid in (EUR)','Description','Currency'];
    const sample = { 'Paid out (EUR)': '-1.23' } as any;
    const { adapter, coverage } = buildHeuristicAdapter(headers, sample);
    // credit/debit
    expect(adapter.map.amount).toMatchObject({ creditCol: 'Paid in (EUR)', debitCol: 'Paid out (EUR)' });
    expect(coverage).toBeGreaterThanOrEqual(0.66);
  });
});


