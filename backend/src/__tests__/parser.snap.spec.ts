import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseBufferAuto } from '@nimbus/parser-de';

const FIX = path.join(process.cwd(), '..', 'parser-de', 'src', 'fixtures');

for (const f of ['sparkasse_sample.csv','dkb_sample.csv','ing_sample.csv','n26_sample.csv','revolut_sample.csv','bunq_sample.csv']) {
  describe(`parser snapshot: ${f}`, () => {
    it('maps to canonical', async () => {
      const buf = fs.readFileSync(path.join(FIX, f));
      const out = await parseBufferAuto(buf, { accountId: 'acc_test' });
      expect((out as any).adapterId ?? 'camt.053').toBeTruthy();
      const rows = (out as any).canonical ?? [];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows).toMatchSnapshot();
    });
  });
}

describe('parser snapshot: camt_sample.xml', () => {
  it('maps to canonical', async () => {
    const buf = fs.readFileSync(path.join(FIX, 'camt_sample.xml'));
    const out = await parseBufferAuto(buf, { accountId: 'acc_test' });
    expect((out as any).adapterId ?? 'camt.053').toBeTruthy();
    const rows = (out as any).canonical ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows).toMatchSnapshot();
  });
});


