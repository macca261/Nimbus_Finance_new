import { CanonicalRow, CsvRow, ParseCtx, parseDeDate, parseEuroToCents, normalizeWs } from '../utils.js'

export const id = 'de.comdirect.csv'

const POSSIBLE = [
  'buchungstag','wertstellung','verwendungszweck','betrag','währung','buchungstext','code','saldo','auftragskonto','iban','empfänger','gegenkonto','text','betrag (eur)'
]
const COMDIRECT_SPECIFIC = ['buchungstext','vorgang','umsatz in eur','betrag (eur)']

export function matches(headers: string[]): boolean {
  const set = headers.map(h => h.trim().toLowerCase())
  // Needs to look like a DE bank CSV and include at least one Comdirect-specific header
  const looksGerman = set.some(h => POSSIBLE.includes(h))
  const hasSpecific = set.some(h => COMDIRECT_SPECIFIC.includes(h))
  return looksGerman && hasSpecific
}

export function parse(rows: CsvRow[], _ctx: ParseCtx): CanonicalRow[] {
  const out: CanonicalRow[] = []
  for (const r of rows) {
    const bookingDate = parseDeDate(r['Buchungstag'] || r['Buchungsdatum'] || r['Date'])
    const valueDate = parseDeDate(r['Wertstellung'] || r['Valuta'])
    const amountRaw = r['Betrag (EUR)'] ?? r['Betrag'] ?? r['Umsatz'] ?? r['Amount']
    const amountCents = parseEuroToCents(amountRaw || '0')
    const currency = r['Währung'] || r['Currency'] || 'EUR'
    const purpose = normalizeWs((r['Verwendungszweck'] || r['Text'] || r['Buchungstext'] || r['Verwendungszweck (Erweitert)'] || '').toString())
    const counterpartName = r['Gegenkonto'] || r['Empfänger'] || r['Name']
    const accountIban = (r['IBAN'] || r['Auftragskonto'] || '').replace(/\s+/g,'')
    const rawCode = r['Code'] || r['Buchungstext']
    if (bookingDate) out.push({ bookingDate, valueDate: valueDate || undefined, amountCents, currency, purpose, counterpartName, accountIban, rawCode })
  }
  return out
}


