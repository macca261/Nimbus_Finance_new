import { db } from '../../src/db';

function q<T = any>(sql: string, ...args: any[]): T {
  return db.prepare(sql).get(...args) as T;
}
function qa<T = any>(sql: string, ...args: any[]): T[] {
  return db.prepare(sql).all(...args) as T[];
}

// Balance
const bal = q<{ sum: number }>(`SELECT COALESCE(SUM(amountCents),0) AS sum FROM transactions`);

// Last 3 tx
const last = qa<{ bookingDate: string; purpose: string; amountCents: number }>(
  `SELECT bookingDate, purpose, amountCents FROM transactions ORDER BY bookingDate DESC, id DESC LIMIT 3`
);

// Monthly (last 6 by label)
const months = qa<{ ym: string; inc: number; exp: number }>(
  `WITH RECURSIVE months(ym, n) AS (
    SELECT strftime('%Y-%m', date('now','start of month')), 0
    UNION ALL
    SELECT strftime('%Y-%m', date(ym||'-01','-1 month')), n+1 FROM months WHERE n < 5
  )
  SELECT m.ym,
         COALESCE((SELECT SUM(amountCents) FROM transactions WHERE amountCents>0 AND strftime('%Y-%m', bookingDate)=m.ym),0) AS inc,
         ABS(COALESCE((SELECT SUM(amountCents) FROM transactions WHERE amountCents<0 AND strftime('%Y-%m', bookingDate)=m.ym),0)) AS exp
  FROM months m ORDER BY m.ym`
);

// Top categories
const cats = qa<{ category: string; spend: number }>(
  `SELECT COALESCE(NULLIF(TRIM(category),''),'Other') AS category,
          ABS(COALESCE(SUM(CASE WHEN amountCents<0 THEN amountCents ELSE 0 END),0)) AS spend
   FROM transactions GROUP BY category ORDER BY spend DESC LIMIT 5`
);

console.log('Balance:', bal?.sum ?? 0);
console.log('Last 3:', last.map(r => `${r.bookingDate} ${r.purpose} ${(r.amountCents/100).toFixed(2)}€`).join(' | '));
console.log('Monthly:', months.map(m => `${m.ym}: +${(m.inc/100).toFixed(2)}€/-${(m.exp/100).toFixed(2)}€`).join(' | '));
console.log('Top cats:', cats.map(c => `${c.category}:${(c.spend/100).toFixed(2)}€`).join(', '));

process.exit(0);


