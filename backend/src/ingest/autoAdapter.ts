type LocaleNumberRule = { col: string; locale?: string };
type CreditDebitRule = { creditCol: string; debitCol: string; locale?: string };
type MapValueRule = string | string[] | LocaleNumberRule | CreditDebitRule;
type Adapter = { id: string; match: { anyHeader?: string[] }; map: Record<string, MapValueRule> };

function norm(h: string): string {
  return (h || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function pick(headers: string[], names: string[], re?: RegExp): string | undefined {
  const H = headers.map(norm);
  for (const n of names) {
    const i = H.indexOf(norm(n));
    if (i >= 0) return headers[i];
  }
  if (re) {
    for (let i = 0; i < headers.length; i++) {
      if (re.test(norm(headers[i]))) return headers[i];
    }
  }
  return undefined;
}

export function buildHeuristicAdapter(headers: string[], sample: Record<string, string>): { adapter: Adapter; coverage: number; reasons: string[] } {
  const reasons: string[] = [];
  const bookingDate = pick(headers, ['buchungstag','buchungsdatum','date','completed date','datum','posting date'], /(buch|post|book|completed|datum|date)/);
  if (bookingDate) reasons.push(`bookingDate:${bookingDate}`);
  const valueDate = pick(headers, ['valuta','wertstellung','valuedate'], /(valuta|wertstell|value)/);
  if (valueDate) reasons.push(`valueDate:${valueDate}`);

  const paidIn = pick(headers, ['paid in (eur)','paid in','credit amount']);
  const paidOut = pick(headers, ['paid out (eur)','paid out','debit amount']);
  const amountCol = pick(headers, ['betrag (eur)','betrag','amount','umsatz (eur)','umsatz in eur']);
  let amountRule: MapValueRule | undefined;
  if (paidIn && paidOut) {
    amountRule = { creditCol: paidIn, debitCol: paidOut, locale: 'en-GB' } as CreditDebitRule;
    reasons.push(`amount:creditDebit(${paidIn},${paidOut})`);
  } else if (amountCol) {
    const v = sample[amountCol] ?? '';
    const locale = /,\d{1,2}$/.test(String(v)) ? 'de-DE' : undefined;
    amountRule = { col: amountCol, locale } as LocaleNumberRule;
    reasons.push(`amount:${amountCol}${locale ? `(${locale})` : ''}`);
  }

  const currency = pick(headers, ['währung','currency','currency code','ccy']); if (currency) reasons.push(`currency:${currency}`);
  const purpose = pick(headers, ['verwendungszweck','reference','beschreibung','description','payment reference','vorgang/verwendungszweck']); if (purpose) reasons.push(`purpose:${purpose}`);
  const counterpartName = pick(headers, ['auftraggeber/empfänger','begünstigter/zahlungspflichtiger','payee','counterparty','name','beneficiary','merchant']); if (counterpartName) reasons.push(`counterpartName:${counterpartName}`);
  const counterpartIban = pick(headers, ['iban','account number','kontonummer']); if (counterpartIban) reasons.push(`counterpartIban:${counterpartIban}`);
  const counterpartBic = pick(headers, ['bic','swift']); if (counterpartBic) reasons.push(`counterpartBic:${counterpartBic}`);
  const txType = pick(headers, ['buchungstext','transaction type','type']); if (txType) reasons.push(`txType:${txType}`);
  const rawCode = txType || undefined;

  const coreFound = [bookingDate, amountRule ? 'amount' : undefined, currency, purpose, counterpartName, txType].filter(Boolean).length;
  let coverage = coreFound / 6;
  if (valueDate) coverage += 0.5 / 6; // small bonus

  const map: Record<string, MapValueRule> = {};
  if (bookingDate) map.bookingDate = bookingDate;
  if (valueDate) map.valueDate = valueDate;
  if (amountRule) map.amount = amountRule;
  if (currency) map.currency = currency;
  if (purpose) map.purpose = purpose;
  if (counterpartName) map.counterpartName = counterpartName;
  if (counterpartIban) map.counterpartIban = counterpartIban;
  if (counterpartBic) map.counterpartBic = counterpartBic;
  if (txType) map.txType = txType;
  if (rawCode) map.rawCode = rawCode;

  const adapter: Adapter = {
    id: 'auto_csv_v1',
    match: { anyHeader: headers.slice(0, 10) },
    map,
  };

  return { adapter, coverage, reasons };
}


