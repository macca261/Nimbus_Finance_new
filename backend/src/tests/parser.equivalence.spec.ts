import { describe, it, expect } from 'vitest';
import { parseBufferAuto } from '@nimbus/parser-de';

const csv = Buffer.from(
  'Buchungstag;Valutadatum;Betrag;Währung;Verwendungszweck\n' +
  '01.10.2025;01.10.2025;-12,34;EUR;REWE MARKT\n' +
  '02.10.2025;02.10.2025;-9,99;EUR;SPOTIFY\n', 'utf8');

const camt = Buffer.from(`<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt><Stmt>
    <Ntry><Amt ccy="EUR">-12.34</Amt><BookgDt><Dt>2025-10-01</Dt></BookgDt><RmtInf><Ustrd>REWE MARKT</Ustrd></RmtInf></Ntry>
    <Ntry><Amt ccy="EUR">-9.99</Amt><BookgDt><Dt>2025-10-02</Dt></BookgDt><RmtInf><Ustrd>SPOTIFY</Ustrd></RmtInf></Ntry>
  </Stmt></BkToCstmrStmt>
</Document>`, 'utf8');

function canon(out: any) {
  const rows = (out.canonical as any[]) || [];
  const mapped = rows.map((r) => ({
    bookingDate: r.booking_date ?? r.bookingDate,
    amount: r.amount,
    currency: r.currency ?? 'EUR',
    purpose: String(r.purpose || '').toLowerCase(),
  }));
  return mapped.sort((a, b) => (a.bookingDate + String(a.amount)).localeCompare(b.bookingDate + String(b.amount)));
}

describe('csv vs camt equivalence', () => {
  it('produces identical canonical where fields overlap', async () => {
    const a = await parseBufferAuto(csv, { accountId: 'acc_eq' });
    const b = await parseBufferAuto(camt, { accountId: 'acc_eq' });
    expect(canon(a)).toEqual(canon(b));
  });
});


