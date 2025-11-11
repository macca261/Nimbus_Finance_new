import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import path from 'node:path'
import { makeTestApp, resetDb, fixturePath } from './helpers/test-utils'

let app: any; let db: any;
beforeEach(() => { const made = makeTestApp(); app = made.app; db = made.db; resetDb(db); })

function exists(p: string) { try { fs.accessSync(p); return true; } catch { return false; } }
function loadFixtureBuffer(rel: string, inlineFallback: string): Buffer {
  const p = fixturePath(rel)
  if (exists(p)) return fs.readFileSync(p)
  return Buffer.from(inlineFallback, 'utf8')
}

const INLINE_MIN = [
  'Buchungstag;Wertstellung;Verwendungszweck;Betrag;Währung;IBAN;Gegenkonto;Kategorie;Code',
  '01.03.2025;01.03.2025;GEHALT ACME GMBH;3.000,00;EUR;DE00123456780000000000;;;Gehalt',
  '02.03.2025;02.03.2025;REWE MARKT 123 BERLIN;-31,24;EUR;DE00123456780000000000;;;Kartenzahlung',
  '03.03.2025;03.03.2025;KARTENENTGELT MÄRZ;-9,90;EUR;DE00123456780000000000;;;Gebühr',
].join('\n')

describe('Comdirect import', () => {
  it('imports comdirect_min.csv', async () => {
    const pre = await request(app).get('/api/summary/balance')
    const preCents = (pre.body?.data || pre.body)?.balanceCents ?? 0
    const buf = loadFixtureBuffer('comdirect_min.csv', INLINE_MIN)
    const res = await request(app).post('/api/import').attach('file', buf, 'comdirect_min.csv')
    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.transactionCount).toBeGreaterThan(0)

    const bal = await request(app).get('/api/summary/balance')
    const postCents = (bal.body?.data || bal.body)?.balanceCents ?? 0
    expect(postCents - preCents).toBe(300000 - 3124 - 990)

    const stats = await request(app).get('/api/debug/stats')
    expect(stats.status).toBe(200)
    const cnt = (stats.body?.data || stats.body)?.count ?? 0
    expect(cnt).toBeGreaterThan(0)

    const tx = await request(app).get('/api/transactions/recent?limit=5')
    expect(tx.status).toBe(200)
    const list = (tx.body?.transactions ?? tx.body?.data ?? []) as any[]
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
    const purposes = list.map((t: any) => String(t.purpose || '')).join(' \n ')
    expect(purposes).toMatch(/GEHALT ACME/i)
    expect(purposes).toMatch(/REWE/i)
    expect(purposes).toMatch(/KARTENENTGELT/i)
    expect(list.some((t: any) => t.category === 'income_salary')).toBe(true)
    expect(list.some((t: any) => t.category === 'groceries')).toBe(true)
    expect(list.some((t: any) => t.category === 'fees_charges')).toBe(true)
  })

  it('imports real file if present (smoke)', async () => {
    const real = fixturePath('comdirect_real.csv')
    if (!exists(real)) return
    
    const buf = fs.readFileSync(real)
    const res = await request(app).post('/api/import').attach('file', buf, 'comdirect_real.csv')
    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.transactionCount).toBeGreaterThan(0)
  })
})


