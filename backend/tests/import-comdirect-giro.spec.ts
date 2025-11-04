import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import path from 'node:path'
import fs from 'node:fs'
import { makeTestApp, resetDb } from './helpers/test-utils'

let app: any; let db: any
beforeEach(() => { const made = makeTestApp(); app = made.app; db = made.db; resetDb(db); })

describe('Comdirect Giro CSV', () => {
  it('imports giro CSV and normalizes fields', async () => {
    const before = await request(app).get('/api/summary/balance')
    const beforeCents = (before.body?.data || before.body)?.balanceCents ?? 0

    const fx = path.join(process.cwd(), 'tests', 'fixtures', 'comdirect_giro_min_clean.csv')
    fs.writeFileSync(fx, [
      ';',
      '"Umsätze Girokonto";"Zeitraum: 30 Tage";',
      '"Neuer Kontostand";"97,93 EUR";',
      '',
      '"Buchungstag";"Wertstellung (Valuta)";"Vorgang";"Buchungstext";"Umsatz in EUR"',
      '"27.10.2025";"27.10.2025";"Lastschrift / Belastung";"Miete";"-66,99"',
      '"27.10.2025";"27.10.2025";"Kartenverfügung";"REWE MARKT 123 BERLIN";"-12,34"',
      '"01.03.2025";"01.03.2025";"Gutschrift";"GEHALT ACME GMBH";"3.000,00"',
    ].join('\n'), 'utf8')

    const res = await request(app).post('/api/imports/csv').attach('file', fx)
    expect(res.status).toBe(200)
    const data = res.body?.data || res.body
    expect(data.imported).toBe(3)

    const after = await request(app).get('/api/summary/balance')
    const afterCents = (after.body?.data || after.body)?.balanceCents ?? 0
    expect(afterCents - beforeCents).toBe(300000 - 6699 - 1234)

    const tx = await request(app).get('/api/transactions?limit=10')
    expect(tx.status).toBe(200)
    const list = tx.body?.data || []
    const amounts = new Set(list.map((t: any) => Number(t.amountCents)))
    expect(amounts.has(-6699)).toBe(true)
    expect(amounts.has(-1234)).toBe(true)
    expect(amounts.has(300000)).toBe(true)
    const dates = new Set(list.map((t: any) => String(t.bookingDate)))
    expect(dates.has('2025-10-27')).toBe(true)
    expect(dates.has('2025-03-01')).toBe(true)
  })
})


