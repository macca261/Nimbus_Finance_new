import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db';

beforeEach(() => {
  db.exec(`DELETE FROM transactions`);
});

function monthly() {
  const rows = db.prepare(`
    WITH RECURSIVE months(ym, n) AS (
      SELECT strftime('%Y-%m', date('now','start of month')), 0
      UNION ALL
      SELECT strftime('%Y-%m', date(ym||'-01','-1 month')), n+1 FROM months WHERE n < 5
    )
    SELECT m.ym,
           COALESCE((SELECT SUM(amountCents) FROM transactions WHERE amountCents>0 AND strftime('%Y-%m', bookingDate)=m.ym),0) AS inc,
           ABS(COALESCE((SELECT SUM(amountCents) FROM transactions WHERE amountCents<0 AND strftime('%Y-%m', bookingDate)=m.ym),0)) AS exp
    FROM months m ORDER BY m.ym
  `).all() as { ym: string; inc: number; exp: number }[];
  return rows;
}

function categories() {
  return db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(category),''),'Other') AS category,
           ABS(COALESCE(SUM(CASE WHEN amountCents<0 THEN amountCents ELSE 0 END),0)) AS spend
    FROM transactions GROUP BY category ORDER BY spend DESC
  `).all() as { category: string; spend: number }[];
}

function balance() {
  const r = db.prepare(`SELECT COALESCE(SUM(amountCents),0) AS sum FROM transactions`).get() as { sum: number };
  return r.sum;
}

describe('summaries', () => {
  it('empty DB -> zeros', () => {
    expect(monthly().length).toBe(6);
    expect(categories()).toEqual([]);
    expect(balance()).toBe(0);
  });

  it('seeded DB -> non-zero', () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    db.prepare(`INSERT INTO transactions (bookingDate, amountCents, currency) VALUES (?,?,?)`).run(`${ym}-01`, 1000, 'EUR');
    db.prepare(`INSERT INTO transactions (bookingDate, amountCents, currency, category) VALUES (?,?,?,?)`).run(`${ym}-02`, -500, 'EUR', 'Groceries');
    expect(balance()).toBe(500);
    const m = monthly();
    expect(m.length).toBe(6);
    expect(m[m.length-1].inc).toBeGreaterThan(0);
    const c = categories();
    expect(c.length).toBeGreaterThan(0);
  });
});


