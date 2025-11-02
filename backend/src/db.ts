import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

export type CanonicalRow = {
  bookingDate?: string
  valueDate?: string
  amountCents?: number
  currency?: string
  purpose?: string
  counterpartName?: string
  accountIban?: string
  rawCode?: string
  category?: string
  categoryConfidence?: number
}

const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'dev.db')

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookingDate TEXT,
  valueDate   TEXT,
  amountCents INTEGER NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'EUR',
  purpose     TEXT,
  counterpartName TEXT,
  accountIban TEXT,
  rawCode     TEXT,
  category    TEXT,
  categoryConfidence REAL,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tx_bookingDate ON transactions(bookingDate);
CREATE INDEX IF NOT EXISTS idx_tx_createdAt  ON transactions(createdAt);
`)

function columnExists(table: string, col: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return rows.some(r => r.name === col)
}

function runMigrations() {
  // v1 -> v2: add fingerprint column & unique index if missing
  if (!columnExists('transactions', 'fingerprint')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN fingerprint TEXT`)
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_tx_fingerprint ON transactions(fingerprint)`)
  // v2 -> v3: add category columns
  if (!columnExists('transactions', 'category')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN category TEXT`)
  }
  if (!columnExists('transactions', 'categoryConfidence')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN categoryConfidence REAL`)
  }
}

runMigrations()

export function txFingerprint(r: {
  bookingDate?: string
  valueDate?: string
  amountCents?: number
  currency?: string
  purpose?: string
  counterpartName?: string
  accountIban?: string
}) {
  const norm = (s?: string) => (s ?? '').trim().replace(/\s+/g,' ').toLowerCase()
  const parts = [
    r.bookingDate ?? '',
    r.valueDate ?? '',
    String(r.amountCents ?? 0),
    (r.currency ?? 'EUR').toUpperCase(),
    norm(r.purpose),
    norm(r.counterpartName),
    (r.accountIban ?? '').replace(/\s+/g,'').toUpperCase(),
  ]
  const data = parts.join('|')
  return crypto.createHash('sha256').update(data).digest('hex')
}

const insertTx = db.prepare(`
INSERT OR IGNORE INTO transactions
(bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode, category, categoryConfidence, fingerprint)
VALUES (@bookingDate, @valueDate, @amountCents, @currency, @purpose, @counterpartName, @accountIban, @rawCode, @category, @categoryConfidence, @fingerprint)
`)

export function insertTransactions(rows: CanonicalRow[]) {
  let inserted = 0, duplicates = 0
  const tx = db.transaction((batch: CanonicalRow[]) => {
    for (const r of batch) {
      const rec: any = { ...r, fingerprint: txFingerprint(r) }
      const info = insertTx.run(rec)
      if ((info as any).changes === 1) inserted++
      else duplicates++
    }
  })
  tx(rows)
  return { inserted, duplicates }
}

export function getRecentTransactions(limit = 10) {
  return db.prepare(`
    SELECT id, bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode
    FROM transactions
    ORDER BY date(bookingDate) DESC, id DESC
    LIMIT ?
  `).all(limit)
}

export function getBalance() {
  const row = db.prepare(`
    SELECT COALESCE(SUM(amountCents), 0) AS balanceCents
    FROM transactions
  `).get()
  return row as { balanceCents: number }
}

export function clearAll() {
  db.exec(`DELETE FROM transactions`)
}


