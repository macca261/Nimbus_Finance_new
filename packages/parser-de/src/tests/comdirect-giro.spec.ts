import { describe, it, expect } from 'vitest'
import { parseBufferAuto } from '../index'
import * as comdirectGiro from '../adapters/comdirect-giro'

function makeFixture(): Buffer {
  const content = [
    ';',
    '"Umsätze Girokonto";"Zeitraum: 30 Tage";',
    '"Neuer Kontostand";"97,93 EUR";',
    '',
    '"Buchungstag";"Wertstellung (Valuta)";"Vorgang";"Buchungstext";"Umsatz in EUR";',
    '"27.10.2025";"27.10.2025";"Lastschrift / Belastung";"REWE MARKT 123 BERLIN";"-31,24";',
    '"27.10.2025";"27.10.2025";"KARTENENTGELT";"KARTENENTGELT MÄRZ";"-9,90";',
    '"01.03.2025";"01.03.2025";"Gutschrift";"GEHALT ACME GMBH";"3.000,00";',
    ''
  ].join('\n')
  return Buffer.from(content, 'utf8')
}

describe('Comdirect Giro adapter', () => {
  it('detects preamble CSV', () => {
    const buf = makeFixture()
    expect(comdirectGiro.detect(buf)).toBe(true)
  })

  it('parses 3 rows with correct amounts and dates', () => {
    const buf = makeFixture()
    const res = parseBufferAuto(buf)
    if ('needsMapping' in res) throw new Error('expected parsed result')
    expect(res.adapterId).toBe('de.comdirect.csv.giro')
    expect(res.rows.length).toBe(3)
    const cents = res.rows.map(r => r.amountCents)
    expect(cents).toContain(-3124)
    expect(cents).toContain(-990)
    expect(cents).toContain(300000)
    const dates = new Set(res.rows.map(r => r.bookingDate))
    expect(dates.has('2025-10-27')).toBe(true)
    expect(dates.has('2025-03-01')).toBe(true)
  })

  it('normalizes purpose and raw references', () => {
    const { purpose, rawCode } = comdirectGiro.normalizePurpose('Auftraggeber: ACME GmbH Buchungstext: PAYPAL *OPENAI Ref. 1234567890 EREF+ABC123')
    expect(purpose).toBe('PAYPAL *OPENAI')
    expect(rawCode).toContain('Ref. 1234567890')
    expect(rawCode).toContain('EREF+ABC123')
  })
})


