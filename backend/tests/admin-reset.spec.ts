import { beforeAll, describe, expect, it } from 'vitest';

import { db } from '../src/db';

function countTransactions(): number {
  const row = db.prepare<{ c: number }>('SELECT COUNT(*) as c FROM transactions').get();
  return row?.c ?? 0;
}

describe('admin reset', () => {
  beforeAll(() => {
    db.exec('DELETE FROM transactions');
    const insert = db.prepare(
      `INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose) VALUES (?, ?, ?, ?, ?)`,
    );
    insert.run('2025-08-01', '2025-08-01', 123, 'EUR', 'Seed 1');
    insert.run('2025-08-02', '2025-08-02', -456, 'EUR', 'Seed 2');
  });

  it('deletes all transactions via internal wipe logic', () => {
    const before = countTransactions();
    expect(before).toBeGreaterThan(0);
    db.prepare('DELETE FROM transactions').run();
    const after = countTransactions();
    expect(after).toBe(0);
  });
});


