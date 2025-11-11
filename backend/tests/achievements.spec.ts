import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { makeTestApp, resetDb } from './helpers/test-utils'
import { insertManyTransactions, type InsertRow } from '../src/insert'

let app: any
let db: any

beforeEach(() => {
  const made = makeTestApp()
  app = made.app
  db = made.db
  resetDb(db)
})

function seed(rows: InsertRow[]) {
  insertManyTransactions(db, rows)
}

const DATA_GOOD: InsertRow[] = [
  { bookingDate: '2025-03-01', valueDate: '2025-03-01', amountCents: 300000, currency: 'EUR', purpose: 'GEHALT ACME GMBH', category: 'income_salary', direction: 'in' },
  { bookingDate: '2025-03-02', valueDate: '2025-03-02', amountCents: -5000, currency: 'EUR', purpose: 'REWE MARKT 123', category: 'groceries', direction: 'out' },
  { bookingDate: '2025-03-03', valueDate: '2025-03-03', amountCents: -3000, currency: 'EUR', purpose: 'BVG MONATSKARTE', category: 'transport', direction: 'out' },
  { bookingDate: '2025-03-04', valueDate: '2025-03-04', amountCents: -5000, currency: 'EUR', purpose: 'LIDL FILIALE 42', category: 'groceries', direction: 'out' },
  { bookingDate: '2025-03-05', valueDate: '2025-03-05', amountCents: -4000, currency: 'EUR', purpose: 'DB REISEZENTRUM', category: 'transport', direction: 'out' },
  { bookingDate: '2025-03-06', valueDate: '2025-03-06', amountCents: -2000, currency: 'EUR', purpose: 'ALDI SÜD 0815', category: 'groceries', direction: 'out' },
  { bookingDate: '2025-03-07', valueDate: '2025-03-07', amountCents: -1000, currency: 'EUR', purpose: 'U-BHF BERLIN', category: 'transport', direction: 'out' },
]

const DATA_FAIL: InsertRow[] = [
  { bookingDate: '2025-04-01', valueDate: '2025-04-01', amountCents: 30000, currency: 'EUR', purpose: 'Gehalt Probe GmbH', category: 'income_salary', direction: 'in' },
  { bookingDate: '2025-04-02', valueDate: '2025-04-02', amountCents: -15000, currency: 'EUR', purpose: 'REWE CITY 99', category: 'groceries', direction: 'out' },
  { bookingDate: '2025-04-03', valueDate: '2025-04-03', amountCents: -5000, currency: 'EUR', purpose: 'KONTOR GEBÜHR', category: 'fees_charges', direction: 'out' },
  { bookingDate: '2025-04-05', valueDate: '2025-04-05', amountCents: -10000, currency: 'EUR', purpose: 'WEEKEND FOOD', category: 'groceries', direction: 'out' },
]

describe('GET /api/achievements', () => {
  it('computes achievements for a month when goals are met', async () => {
    seed(DATA_GOOD)

    const res = await request(app).get('/api/achievements?month=2025-03')
    expect(res.status).toBe(200)
    const list = res.body?.data as any[]
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThanOrEqual(4)

    const get = (id: string) => list.find(a => a.id === id)

    const noFees = get('no-fees')
    const saver = get('saver-500')
    const groceries = get('groceries-under-200')
    const streak = get('streak-7')

    expect(noFees).toBeTruthy()
    expect(saver).toBeTruthy()
    expect(groceries).toBeTruthy()
    expect(streak).toBeTruthy()

    expect(noFees.achieved).toBe(true)
    expect(noFees.progress).toBe(100)

    expect(saver.achieved).toBe(true)
    expect(saver.progress).toBe(100)
    expect(saver.current).toBeCloseTo(2800, 2)
    expect(saver.target).toBe(500)

    expect(groceries.achieved).toBe(true)
    expect(groceries.progress).toBe(40)
    expect(groceries.current).toBeCloseTo(120, 2)
    expect(groceries.target).toBe(200)

    expect(streak.achieved).toBe(true)
    expect(streak.progress).toBe(100)
    expect(streak.current).toBe(7)
    expect(streak.target).toBe(7)
  })

  it('reflects missing achievements when thresholds are not reached', async () => {
    seed(DATA_FAIL)

    const res = await request(app).get('/api/achievements?month=2025-04')
    expect(res.status).toBe(200)
    const list = res.body?.data as any[]
    const get = (id: string) => list.find(a => a.id === id)

    const noFees = get('no-fees')
    const saver = get('saver-500')
    const groceries = get('groceries-under-200')
    const streak = get('streak-7')

    expect(noFees).toBeTruthy()
    expect(saver).toBeTruthy()
    expect(groceries).toBeTruthy()
    expect(streak).toBeTruthy()

    expect(noFees.achieved).toBe(false)
    expect(noFees.progress).toBe(0)

    expect(saver.achieved).toBe(false)
    expect(saver.progress).toBe(0)
    expect(saver.current).toBeCloseTo(0, 2)

    expect(groceries.achieved).toBe(false)
    expect(groceries.progress).toBe(0)
    expect(groceries.current).toBeCloseTo(250, 2)

    expect(streak.achieved).toBe(false)
    expect(streak.current).toBe(3)
    expect(streak.target).toBe(7)
    expect(streak.progress).toBe(43)
  })
})

