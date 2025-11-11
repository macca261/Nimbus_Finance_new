import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTransactions } from '../src/index.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function load(name) {
    return fs.readFileSync(path.join(__dirname, 'fixtures', name));
}
describe('parsers-de', () => {
    it('comdirect parses', () => {
        const out = parseTransactions(load('comdirect_min.csv'));
        expect(out.length).toBeGreaterThan(0);
        expect(out[0].currency).toBe('EUR');
        expect(out[0].bank).toBe('comdirect');
        expect(out[0].bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    it('sparkasse parses', () => {
        const out = parseTransactions(load('sparkasse_min.csv'));
        expect(out.length).toBeGreaterThan(0);
        expect(out[0].bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(out[0].bank).toBe('sparkasse');
        expect(out[0].currency).toBe('EUR');
    });
    it('deutsche-bank parses', () => {
        const out = parseTransactions(load('deutsche_min.csv'));
        expect(out.length).toBeGreaterThan(0);
        expect(out[0].amount).toMatch(/^-?\d+\.\d{2}$/);
        expect(out[0].bank).toBe('deutsche-bank');
        expect(out[0].currency).toBe('EUR');
    });
});
