import type { Database } from 'better-sqlite3';

export type InsertRow = {
  bookingDate: string;
  valueDate: string;
  amountCents: number;
  currency: string;
  purpose: string;
  counterpartName?: string | null;
  accountIban?: string | null;
  rawCode?: string | null;
  category?: string | null;
};

export function insertManyTransactions(db: Database, rows: InsertRow[]) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO transactions
    (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode, category)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);

  let inserted = 0;
  const tx = db.transaction((batch: InsertRow[]) => {
    for (const r of batch) {
      const info = stmt.run(
        r.bookingDate,
        r.valueDate,
        r.amountCents,
        r.currency,
        r.purpose || '',
        r.counterpartName ?? null,
        r.accountIban ?? null,
        r.rawCode ?? null,
        r.category ?? null
      );
      inserted += info.changes; // 1 if new, 0 if duplicate
    }
  });

  tx(rows);
  const duplicates = rows.length - inserted;
  return { inserted, duplicates };
}
