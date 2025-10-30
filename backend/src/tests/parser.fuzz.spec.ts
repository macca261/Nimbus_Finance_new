import { describe, it, expect } from 'vitest';
import { parseBufferAuto } from '@nimbus/parser-de';

function makeCsv({ del = ';', enc = 'utf8', badQuote = false }: { del?: string; enc?: 'utf8' | 'cp1252'; badQuote?: boolean }) {
  const head = `Buchungstag${del}Valutadatum${del}Betrag${del}Währung${del}Verwendungszweck`;
  const row1 = `01.10.2025${del}01.10.2025${del}-12,34${del}EUR${del}"Einkauf\nKöln"`;
  const row2 = `02.10.2025${del}02.10.2025${del}-9,99${del}EUR${del}${badQuote ? '"SPOTIFY' : 'SPOTIFY'}`;
  const text = [head, row1, row2].join('\n');
  if (enc === 'cp1252') {
    const u = text.replace('Köln', 'K\xF6ln'); // ö
    return Buffer.from(u, 'binary');
  }
  return Buffer.from(text, 'utf8');
}

describe('parser fuzz', () => {
  const dels = [';', ',', '\t'];
  for (const d of dels) {
    it(`handles delimiter ${JSON.stringify(d)}`, async () => {
      const buf = makeCsv({ del: d });
      const out = await parseBufferAuto(buf, { accountId: 'acc_fuzz' });
      const n = (out as any).canonical?.length ?? 0;
      expect(n).toBeGreaterThanOrEqual(2);
    });
  }
  it('handles cp1252 umlauts & multiline', async () => {
    const buf = makeCsv({ enc: 'cp1252' });
    const out = await parseBufferAuto(buf, { accountId: 'acc_fuzz' });
    expect((out as any).canonical?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
  it('does not throw on broken quotes (relaxed mode)', async () => {
    const buf = makeCsv({ badQuote: true });
    const out = await parseBufferAuto(buf, { accountId: 'acc_fuzz' });
    expect((out as any).canonical?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});


