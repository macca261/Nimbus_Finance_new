import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import type { Database } from '../../src/db';
import { openDb, ensureSchema } from '../../src/db';

describe('Sonstiges Cleanup Wizard', () => {
  let app: any;
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    app = createApp({ db } as any);
  });

  function insertTx(p: Partial<{ bookingDate: string; amountCents: number; purpose: string; counterpartName: string; payee: string; category: string; flags: Partial<{ isRefund: number; isRefunded: number; isInternalTransfer: number; isReimbursement: number; isPassThrough: number }> }>) {
    const {
      bookingDate = '2025-10-01',
      amountCents = -1000,
      purpose = 'Sonstiges Einkauf',
      counterpartName = 'Muster GmbH',
      payee = 'MUSTER',
      category = 'other_review',
      flags = {},
    } = p;
    const stmt = db.prepare(`INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, payee, category, isRefund, isRefunded, isInternalTransfer, isReimbursement, isPassThrough)
      VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(bookingDate, bookingDate, amountCents, purpose, counterpartName, payee, category,
      flags.isRefund ?? 0, flags.isRefunded ?? 0, flags.isInternalTransfer ?? 0, flags.isReimbursement ?? 0, flags.isPassThrough ?? 0);
  }

  it('groups Sonstiges by normalized merchant and applies category updates', async () => {
    // Group A (same merchant)
    insertTx({ purpose: 'Kauf bei REWE Markt', counterpartName: 'REWE', payee: 'REWE', amountCents: -1500 });
    insertTx({ purpose: 'REWE sagt Danke', counterpartName: 'REWE', payee: 'REWE', amountCents: -2500 });
    // Group B (other merchant)
    insertTx({ purpose: 'Essen bestellen', counterpartName: 'FOODCO', payee: 'FOODCO', amountCents: -3000 });
    // Excluded flagged items
    insertTx({ purpose: 'Refunded', counterpartName: 'REWE', payee: 'REWE', amountCents: -1500, flags: { isRefund: 1 } });
    insertTx({ purpose: 'Internal', counterpartName: 'FOODCO', payee: 'FOODCO', amountCents: -1000, flags: { isInternalTransfer: 1 } });

    // Summary
    const summary = await request(app).get('/api/review/sonstiges-summary?days=365').expect(200);
    expect(summary.body?.totalSonstigesCents).toBeGreaterThan(0);
    const groups: any[] = summary.body?.groups ?? [];
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const reweGroup = groups.find(g => (g.displayName || '').toLowerCase().includes('rewe')) || groups[0];

    // Apply to REWE group
    const apply = await request(app)
      .post('/api/review/sonstiges/apply')
      .send({ groupId: reweGroup.groupId, categoryId: 'groceries', createRule: true, applyToPast: true })
      .expect(200);
    expect(apply.body?.ok).toBe(true);
    expect(apply.body?.updatedCount).toBeGreaterThan(0);

    // Verify updates
    const rows = db.prepare(`SELECT category, category_source, category_rule_id, isRefund, isInternalTransfer FROM transactions WHERE payee = 'REWE'`).all() as any[];
    // Exclude flagged rows unaffected
    const updatedRows = rows.filter(r => !r.isRefund && !r.isInternalTransfer);
    expect(updatedRows.length).toBeGreaterThan(0);
    for (const r of updatedRows) {
      expect(r.category).toBe('groceries');
      expect(r.category_source).toBe('user');
      expect(String(r.category_rule_id || '')).toContain('bulk_sonstiges:');
    }
    // A rule should have been created
    expect(apply.body?.ruleId).toBeTruthy();
  });
});


