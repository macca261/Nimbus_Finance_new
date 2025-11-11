import { describe, it, expect } from 'vitest';
import { parseTransactions } from '../src/index.js';
describe('comdirect preamble + ; + comma decimals', () => {
    it('skips preamble and parses', () => {
        const csv = Buffer.from([
            'Kontoauszug für Oktober 2025', // preamble
            'Kontoinhaber;XYZ', // preamble
            '', // blank
            'Buchungstag;Wertstellung;Buchungstext;Umsatz in EUR',
            '01.10.2025;01.10.2025;REWE Markt;1.234,56-',
            '03.10.2025;03.10.2025;Gehalt;2.000,00',
        ].join('\n'), 'utf8');
        const out = parseTransactions(csv);
        expect(out.length).toBe(2);
        expect(out[0].amount).toBe('-1234.56');
        expect(out[1].amount).toBe('2000.00');
    });
});
