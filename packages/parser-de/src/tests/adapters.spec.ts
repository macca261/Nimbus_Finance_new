import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseBufferAuto } from '../index';

function readFixture(p: string) {
  return fs.readFileSync(path.join(__dirname, '..', 'fixtures', p));
}

describe('German CSV adapters', () => {
  it('Commerzbank CSV parses with correct adapter and amounts', () => {
    const buf = readFixture('commerzbank_sample.csv');
    const res = parseBufferAuto(buf);
    if ('needsMapping' in res) throw new Error('expected parsed');
    expect(res.adapterId).toBe('de.commerzbank.csv');
    expect(res.rows.length).toBe(4);
    const amounts = res.rows.map(r => r.amountCents);
    expect(amounts).toContain(300000);
    expect(amounts).toContain(-3124);
    expect(amounts).toContain(-990);
    const hasMultiline = res.rows.some(r => (r.purpose || '').includes('\n'));
    expect(hasMultiline).toBe(false);
    expect(res.rows).toMatchSnapshot();
  });

  it('Sparkasse CSV parses with correct adapter and amounts', () => {
    const buf = readFixture('sparkasse_sample.csv');
    const res = parseBufferAuto(buf);
    if ('needsMapping' in res) throw new Error('expected parsed');
    expect(res.adapterId).toBe('de.sparkasse.csv');
    expect(res.rows.length).toBe(4);
    const amounts = res.rows.map(r => r.amountCents);
    expect(amounts).toContain(300000);
    expect(amounts).toContain(-3124);
    expect(amounts).toContain(-990);
    const hasMultiline = res.rows.some(r => (r.purpose || '').includes('\n'));
    expect(hasMultiline).toBe(false);
    expect(res.rows).toMatchSnapshot();
  });

  it('ING CSV parses with correct adapter and amounts', () => {
    const buf = readFixture('ing_sample.csv');
    const res = parseBufferAuto(buf);
    if ('needsMapping' in res) throw new Error('expected parsed');
    expect(res.adapterId).toBe('de.ing.csv');
    expect(res.rows.length).toBe(4);
    const amounts = res.rows.map(r => r.amountCents);
    expect(amounts).toContain(300000);
    expect(amounts).toContain(-3124);
    expect(amounts).toContain(-990);
    const hasMultiline = res.rows.some(r => (r.purpose || '').includes('\n'));
    expect(hasMultiline).toBe(false);
    expect(res.rows).toMatchSnapshot();
  });

  it('DKB CSV parses with correct adapter and amounts', () => {
    const buf = readFixture('dkb_sample.csv');
    const res = parseBufferAuto(buf);
    if ('needsMapping' in res) throw new Error('expected parsed');
    expect(res.adapterId).toBe('de.dkb.csv');
    expect(res.rows.length).toBe(4);
    const amounts = res.rows.map(r => r.amountCents);
    expect(amounts).toContain(300000);
    expect(amounts).toContain(-3124);
    expect(amounts).toContain(-990);
    const hasMultiline = res.rows.some(r => (r.purpose || '').includes('\n'));
    expect(hasMultiline).toBe(false);
    expect(res.rows).toMatchSnapshot();
  });
});


