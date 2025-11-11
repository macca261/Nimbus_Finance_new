import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import path from 'node:path'
import fs from 'node:fs'
import { createApp } from '../src/server'

describe('Import persistence (single-DB)', () => {
  let app: any
  beforeEach(() => {
    process.env.TEST_DB = '1'
    app = createApp()
  })

  it('upload persists and shows up in summaries', async () => {
    const sample = path.resolve(__dirname, 'fixtures', 'sample.csv')
    expect(fs.existsSync(sample)).toBe(true)

    const res = await request(app)
      .post('/api/import')
      .attach('file', sample)
    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)

    const stats = await request(app).get('/api/debug/stats')
    expect(stats.status).toBe(200)
    const count = (stats.body?.data || stats.body)?.count ?? 0
    expect(count).toBeGreaterThan(0)

    const rows = await request(app).get('/api/debug/rows')
    expect(rows.status).toBe(200)
    const rcount = (rows.body?.data || rows.body)?.count ?? 0
    expect(rcount).toBeGreaterThan(0)

    const bal = await request(app).get('/api/summary/balance')
    expect(bal.status).toBe(200)
    const balanceCents = (bal.body?.data || bal.body)?.balanceCents ?? 0
    expect(balanceCents).not.toBe(0)

    const txs = await request(app).get('/api/transactions/recent?limit=3')
    expect(txs.status).toBe(200)
    const list = (txs.body?.transactions ?? txs.body?.data ?? []) as any[]
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
  })
})


