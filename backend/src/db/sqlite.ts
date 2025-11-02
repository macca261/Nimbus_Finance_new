import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'backend', 'prisma', 'dev.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS Transaction (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  bookingDate TEXT NOT NULL,
  valueDate TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  purpose TEXT,
  counterpartName TEXT,
  counterpartIban TEXT,
  counterpartBic TEXT,
  mandateRef TEXT,
  creditorId TEXT,
  endToEndId TEXT,
  rawCode TEXT,
  txType TEXT,
  categoryId TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_bookingDate ON Transaction(bookingDate);
`);

export type Tx = {
  id: string; accountId: string; bookingDate: string; valueDate?: string;
  amount: number; currency: string; purpose?: string; counterpartName?: string;
  counterpartIban?: string; counterpartBic?: string; mandateRef?: string;
  creditorId?: string; endToEndId?: string; rawCode?: string; txType?: string;
  categoryId?: string;
};

const upsertStmt = db.prepare(`
INSERT INTO Transaction (id, accountId, bookingDate, valueDate, amount, currency, purpose,
  counterpartName, counterpartIban, counterpartBic, mandateRef, creditorId, endToEndId,
  rawCode, txType, categoryId)
VALUES (@id, @accountId, @bookingDate, @valueDate, @amount, @currency, @purpose,
  @counterpartName, @counterpartIban, @counterpartBic, @mandateRef, @creditorId, @endToEndId,
  @rawCode, @txType, @categoryId)
ON CONFLICT(id) DO UPDATE SET
  accountId=excluded.accountId,
  bookingDate=excluded.bookingDate,
  valueDate=excluded.valueDate,
  amount=excluded.amount,
  currency=excluded.currency,
  purpose=excluded.purpose,
  counterpartName=excluded.counterpartName,
  counterpartIban=excluded.counterpartIban,
  counterpartBic=excluded.counterpartBic,
  mandateRef=excluded.mandateRef,
  creditorId=excluded.creditorId,
  endToEndId=excluded.endToEndId,
  rawCode=excluded.rawCode,
  txType=excluded.txType,
  categoryId=excluded.categoryId
`);

export function upsertTransactions(rows: Tx[]) {
  const trx = db.transaction((batch: Tx[]) => {
    for (const r of batch) upsertStmt.run(r);
  });
  try { trx(rows); return { imported: rows.length, duplicates: 0, errors: 0 }; }
  catch { return { imported: 0, duplicates: 0, errors: rows.length }; }
}

export function recentTransactions(limit = 20) {
  const stmt = db.prepare(`SELECT * FROM Transaction ORDER BY bookingDate DESC LIMIT ?`);
  return stmt.all(limit);
}

export function breakdown(from: string, to: string) {
  const stmt = db.prepare(`
    SELECT COALESCE(categoryId,'other') as categoryId, SUM(amount) as total
    FROM Transaction
    WHERE bookingDate >= ? AND bookingDate <= ?
    GROUP BY COALESCE(categoryId,'other')
  `);
  const rows = stmt.all(from, to);
  const map: Record<string, number> = {};
  for (const r of rows) map[r.categoryId] = r.total;
  return map;
}


