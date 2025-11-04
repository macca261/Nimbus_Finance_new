import { db } from '../../src/db'
import { insertManyTransactions, type InsertRow } from '../../src/insert'

const rows: InsertRow[] = [
  { bookingDate: '2025-03-01', valueDate: '2025-03-01', amountCents: 300000, currency: 'EUR', purpose: 'GEHALT ACME GMBH', counterpartName: 'ACME GmbH', category: 'Income' },
  { bookingDate: '2025-03-02', valueDate: '2025-03-02', amountCents: -5000, currency: 'EUR', purpose: 'REWE MARKT 123', category: 'Groceries' },
  { bookingDate: '2025-03-03', valueDate: '2025-03-03', amountCents: -3000, currency: 'EUR', purpose: 'BVG MONATSKARTE', category: 'Transport' },
  { bookingDate: '2025-03-04', valueDate: '2025-03-04', amountCents: -5000, currency: 'EUR', purpose: 'LIDL FILIALE 42', category: 'Groceries' },
  { bookingDate: '2025-03-05', valueDate: '2025-03-05', amountCents: -4000, currency: 'EUR', purpose: 'DB REISEZENTRUM', category: 'Transport' },
  { bookingDate: '2025-03-06', valueDate: '2025-03-06', amountCents: -2000, currency: 'EUR', purpose: 'ALDI SÜD 0815', category: 'Groceries' },
  { bookingDate: '2025-03-07', valueDate: '2025-03-07', amountCents: -1000, currency: 'EUR', purpose: 'U-BHF BERLIN', category: 'Transport' },
  { bookingDate: '2025-02-20', valueDate: '2025-02-20', amountCents: 125000, currency: 'EUR', purpose: 'BONUSZAHLUNG', category: 'Income' },
]

insertManyTransactions(db, rows)

console.log('Seeded', rows.length, 'transactions for 2025-02/2025-03')


