import { db } from '../db';

function getLatestYm(): string | null {
  const row = db.prepare(`SELECT strftime('%Y-%m', MAX(bookingDate)) AS ym FROM transactions`).get() as { ym?: string };
  return row?.ym ?? null;
}

function upsertUser(achievementCode: string, unlockedAt: string | null, progress: number) {
  const existing = db.prepare(`SELECT id FROM user_achievements WHERE achievementCode = ?`).get(achievementCode) as { id?: string } | undefined;
  if (existing?.id) {
    db.prepare(`UPDATE user_achievements SET unlockedAt = COALESCE(?, unlockedAt), progress = ? WHERE id = ?`).run(unlockedAt, Math.max(0, Math.min(100, Math.round(progress))), existing.id);
  } else {
    db.prepare(`INSERT INTO user_achievements (id, achievementCode, unlockedAt, progress) VALUES (?, ?, ?, ?)`)
      .run(`ua_${achievementCode}`, achievementCode, unlockedAt, Math.max(0, Math.min(100, Math.round(progress))));
  }
}

export async function evaluateAll(_opts?: { now?: Date }): Promise<void> {
  // FIRST_IMPORT
  const count = (db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number }).c || 0;
  if (count > 0) upsertUser('FIRST_IMPORT', new Date().toISOString(), 100); else upsertUser('FIRST_IMPORT', null, 0);

  // SEVEN_DAY_STREAK: compute longest consecutive days with >=1 tx/day in last 60 days
  const days = db.prepare(`
    SELECT bookingDate AS d, COUNT(1) AS c
    FROM transactions
    WHERE bookingDate >= date('now','-60 day')
    GROUP BY bookingDate
    ORDER BY d ASC
  `).all() as { d: string; c: number }[];
  let longest = 0; let current = 0; let prev: string | null = null;
  for (const r of days) {
    if (!prev) { current = 1; } else {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      const expect = next.toISOString().slice(0,10);
      current = (r.d === expect) ? current + 1 : 1;
    }
    if (current > longest) longest = current;
    prev = r.d;
  }
  const streakProgress = Math.min(100, Math.round(Math.min(longest, 7) / 7 * 100));
  if (longest >= 7) upsertUser('SEVEN_DAY_STREAK', new Date().toISOString(), 100); else upsertUser('SEVEN_DAY_STREAK', null, streakProgress);

  // Latest month net
  const ym = getLatestYm();
  if (ym) {
    const net = db.prepare(`
      SELECT 
        COALESCE((SELECT SUM(amountCents) FROM transactions WHERE amountCents>0 AND strftime('%Y-%m', bookingDate)=?),0) -
        ABS(COALESCE((SELECT SUM(amountCents) FROM transactions WHERE amountCents<0 AND strftime('%Y-%m', bookingDate)=?),0)) AS net
    `).get(ym, ym) as { net: number };
    const netCents = net?.net ?? 0;
    if (netCents >= 50000) upsertUser('MONTHLY_SAVER_500', new Date().toISOString(), 100);
    else upsertUser('MONTHLY_SAVER_500', null, Math.max(0, Math.min(100, Math.round((netCents / 50000) * 100))));

    // Groceries spend < 200€
    const gro = db.prepare(`
      SELECT ABS(COALESCE(SUM(amountCents),0)) AS spend
      FROM transactions 
      WHERE amountCents<0 AND strftime('%Y-%m', bookingDate)=? AND (
        UPPER(purpose) LIKE '%REWE%' OR UPPER(purpose) LIKE '%ALDI%' OR UPPER(purpose) LIKE '%LIDL%' OR UPPER(purpose) LIKE '%EDEKA%' OR
        UPPER(category) LIKE '%GROC%'
      )
    `).get(ym) as { spend: number };
    const spend = gro?.spend ?? 0;
    if (spend < 20000) upsertUser('CATEGORY_MASTER_GROCERIES', new Date().toISOString(), 100);
    else upsertUser('CATEGORY_MASTER_GROCERIES', null, Math.max(0, Math.min(100, Math.round((1 - spend / 20000) * 100))));

    // ZERO_FEES_MONTH
    const fees = db.prepare(`
      SELECT ABS(COALESCE(SUM(amountCents),0)) AS fees
      FROM transactions
      WHERE amountCents<0 AND strftime('%Y-%m', bookingDate)=? AND (
        UPPER(purpose) LIKE '%GEBÜHR%' OR UPPER(purpose) LIKE '%ENTGELT%' OR UPPER(category) LIKE '%FEE%'
      )
    `).get(ym) as { fees: number };
    if ((fees?.fees ?? 0) === 0) upsertUser('ZERO_FEES_MONTH', new Date().toISOString(), 100); else upsertUser('ZERO_FEES_MONTH', null, 0);
  } else {
    upsertUser('MONTHLY_SAVER_500', null, 0);
    upsertUser('CATEGORY_MASTER_GROCERIES', null, 0);
    upsertUser('ZERO_FEES_MONTH', null, 0);
  }
}


