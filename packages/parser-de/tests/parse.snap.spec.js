import { describe, it, expect } from 'vitest';
import { parseBufferAuto, listAdapters } from '../src/index';
const sampleCSV = Buffer.from([
    'Buchungstag;Verwendungszweck;Betrag;Währung',
    '01.03.2024;REWE MARKT;-15,67;EUR',
    '02.03.2024;Gehalt;3.200,00;EUR',
].join('\n'), 'utf8');
describe('parser', () => {
    it('lists adapters', () => {
        expect(listAdapters()).toContain('generic_de');
    });
    it('parses a basic de-DE csv', () => {
        const res = parseBufferAuto(sampleCSV);
        if ('needsMapping' in res)
            throw new Error('expected parsed');
        expect(res.adapterId).toBe('generic_de');
        expect(res.rows.length).toBeGreaterThan(0);
        expect(res.rows[0]).toMatchSnapshot();
    });
});
