import { describe, it, expect } from 'vitest';
import { detectBank } from '../detectBank';

describe('detectBank', () => {
  it.each([
    ['sparkasse.generic', ['auftragskonto', 'buchungstag', 'valutadatum', 'begünstigter/zahlungspflichtiger', 'verwendungszweck', 'betrag', 'waehrung']],
    ['vrbank.legacy', ['buchungstag', 'wertstellung', 'umsatz in eur', 'buchungstext', 'auftraggeber / empfaenger']],
    ['n26.standard', ['date', 'payee', 'transaction type', 'payment reference', 'category', 'amount (eur)']],
    ['revolut.standard', ['type', 'description', 'completed date', 'amount', 'currency', 'state']],
    ['bunq.standard', ['date', 'amount', 'account', 'counterparty', 'name', 'description']],
    ['paypal.de', ['date', 'time', 'timezone', 'name', 'type', 'status', 'gross', 'fee', 'net', 'currency']],
    ['trade_republic.executions', ['timestamp', 'isin', 'ticker', 'type', 'quantity', 'amount', 'currency']],
  ])('detects %s signature', (expectedId, header) => {
    const result = detectBank(header);
    expect(result.signature?.id).toBe(expectedId);
    expect(result.scores[0].score).toBeGreaterThanOrEqual(12);
  });
});


