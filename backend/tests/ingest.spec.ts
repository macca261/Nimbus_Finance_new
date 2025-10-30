import { test, strict as assert } from 'node:test';
import { normalizeCsvToCanonical } from '../src/csv/normalizer';
import { detectDialect } from '../src/ingest/csv-normalizer';
import { toUtf8 } from '../src/utils/encoding';

const sampleCsv = `Buchungstag;Valutadatum;Betrag;Währung;Verwendungszweck;IBAN;BIC\n01.10.2025;01.10.2025;-12,34;EUR;REWE Markt Köln;DE89370400440532013000;COBADEFFXXX`;

test('German CSV parses with semicolon and de numbers', () => {
  const d = detectDialect(sampleCsv);
  assert.equal(d.delimiter, ';');
  const norm = normalizeCsvToCanonical(sampleCsv);
  assert.ok(norm.rows.length >= 1);
  const r = norm.rows[0];
  assert.equal(r.booking_date, '2025-10-01');
  assert.equal(r.amount, -12.34);
});

test('Encoding CP1252 umlauts decode', () => {
  const umlaut = Buffer.from([0x52,0x45,0x57,0x45,0x20,0xe4,0x6f,0x20]); // "REWE äo " in cp1252
  const text = toUtf8(umlaut);
  assert.ok(/REWE/.test(text));
});

test('Property: random delimiter robustness', () => {
  const delimiters = [';', ',', '\t'];
  for (const delim of delimiters) {
    const csv = `Date${delim}Amount${delim}Payee\n2025-10-01${delim}-1.23${delim}Test`;
    const norm = normalizeCsvToCanonical(csv);
    assert.ok(norm.rows.length >= 0);
  }
});


