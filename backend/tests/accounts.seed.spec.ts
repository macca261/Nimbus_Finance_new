import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, ensureSchema, seedAccountsFromExistingTransactions } from '../src/db';
import type { Database } from '../src/db';

describe('Accounts seeding from transactions', () => {
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
  });

  it('seeds accounts from distinct transaction accountId/IBAN pairs and is idempotent', () => {
    const ins = db.prepare(`INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, accountId, direction)
      VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, ?)`);
    ins.run('2025-10-01', '2025-10-01', -1000, 'Einkauf', 'REWE', 'DE-IBAN-001', 'ACC-001', 'out');
    ins.run('2025-10-02', '2025-10-02', -2000, 'Kraftstoff', 'ARAL', 'DE-IBAN-002', 'ACC-002', 'out');
    ins.run('2025-10-03', '2025-10-03', +3000, 'Gehalt', 'Firma', 'DE-IBAN-001', 'ACC-001', 'in');

    seedAccountsFromExistingTransactions(db);

    const rows = db.prepare(`SELECT id, iban, role FROM accounts ORDER BY id`).all() as Array<{ id: string; iban: string | null; role: string }>;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const a = rows.find(r => r.id === 'ACC-001');
    const b = rows.find(r => r.id === 'ACC-002');
    expect(a?.iban).toBe('DE-IBAN-001');
    expect(b?.iban).toBe('DE-IBAN-002');
    expect(a?.role).toBe('spending');

    // Run again (idempotent)
    seedAccountsFromExistingTransactions(db);
    const rows2 = db.prepare(`SELECT COUNT(1) AS c FROM accounts`).get() as { c: number };
    expect(rows2.c).toBe(rows.length);
  });
});


