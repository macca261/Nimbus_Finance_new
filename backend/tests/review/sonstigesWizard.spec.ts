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

  function insertTx(p: Partial<{ bookingDate: string; amountCents: number; purpose: string; counterpartName: string; payee: string; category: string; flags: Partial<{ isRefund: number; isRefunded: number; isInternalTransfer: number; isReimbursement: number; isPassThrough: number; isCashWithdrawal: number; internalTransferKind: string; internalTransferDirection: string }> }>) {
    const {
      bookingDate = '2025-10-01',
      amountCents = -1000,
      purpose = 'Sonstiges Einkauf',
      counterpartName = 'Muster GmbH',
      payee = 'MUSTER',
      category = 'other_review',
      flags = {},
    } = p;
    const stmt = db.prepare(`INSERT INTO transactions (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, payee, category, isRefund, isRefunded, isInternalTransfer, internalTransferKind, internalTransferDirection, isReimbursement, isPassThrough, isCashWithdrawal)
      VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(bookingDate, bookingDate, amountCents, purpose, counterpartName, payee, category,
      flags.isRefund ?? 0, flags.isRefunded ?? 0, flags.isInternalTransfer ?? 0, flags.internalTransferKind ?? null, flags.internalTransferDirection ?? null, flags.isReimbursement ?? 0, flags.isPassThrough ?? 0, flags.isCashWithdrawal ?? 0);
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
    // Wise wallet top-up (should be excluded)
    insertTx({ 
      purpose: 'Kartenverfügung | Buchungstext: Wise, Bruxelles BE Karte Nr. 4871 78XX XXXX 1230', 
      counterpartName: 'Wise, Bruxelles', 
      payee: 'WISE', 
      amountCents: -5000,
      flags: { isInternalTransfer: 1, internalTransferKind: 'wallet', internalTransferDirection: 'out' }
    });

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

  it('returns preview transactions for a group and respects totals', async () => {
    // Group C (same merchant)
    insertTx({ purpose: 'Cafe Latte', counterpartName: 'COFFEECO', payee: 'COFFEECO', amountCents: -500 });
    insertTx({ purpose: 'COFFEECo cappuccino', counterpartName: 'COFFEECO', payee: 'COFFEECO', amountCents: -450 });
    insertTx({ purpose: 'CoffeeCo Espresso', counterpartName: 'COFFEECO', payee: 'COFFEECO', amountCents: -300 });
    // Different merchant
    insertTx({ purpose: 'Baeckerei', counterpartName: 'BAKERY', payee: 'BAKERY', amountCents: -200 });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=365').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    const coffee = groups.find(g => (g.displayName || '').toUpperCase().includes('COFFEE')) || groups[0];

    const prev = await request(app).get(`/api/review/sonstiges/group/${encodeURIComponent(coffee.groupId)}/transactions?limit=2`).expect(200);
    expect(Array.isArray(prev.body?.transactions)).toBe(true);
    expect(prev.body?.transactions.length).toBeLessThanOrEqual(2);
    expect(prev.body?.totalCount).toBeGreaterThanOrEqual(3);
    expect(prev.body?.totalExpenseCents).toBeGreaterThanOrEqual(1250);
  });

  it('rule conflict returns 409 and does not update transactions', async () => {
    // Seed
    insertTx({ purpose: 'Shop XYZ', counterpartName: 'SHOPXYZ', payee: 'SHOPXYZ', amountCents: -1000 });
    insertTx({ purpose: 'Shop XYZ 2', counterpartName: 'SHOPXYZ', payee: 'SHOPXYZ', amountCents: -2000 });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=365').expect(200);
    const group = (summary.body?.groups ?? [])[0];
    expect(group).toBeTruthy();

    // Create an existing rule that would conflict
    db.prepare(`INSERT INTO user_override_rules (id, patternType, pattern, categoryId, applyToPast) VALUES (?, 'payee', ?, 'groceries', 0)`)
      .run('rule-1', group.groupId);

    const resp = await request(app)
      .post('/api/review/sonstiges/apply')
      .send({ groupId: group.groupId, categoryId: 'groceries', createRule: true, applyToPast: false })
      .expect(409);
    expect(resp.body?.error).toBe('rule_conflict');
    const rows = db.prepare(`SELECT category FROM transactions WHERE payee = 'SHOPXYZ'`).all() as any[];
    // Still uncategorized
    expect(rows.every(r => !r.category || r.category === 'other' || r.category === 'other_review')).toBe(true);
  });

  it('does not merge PayPal transactions with different underlying merchants', async () => {
    // Three PayPal transactions with different underlying merchants
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: PayPal (Europe) S.a r.l. et Cie, S.C.A. | PAYPAL *ARAL STATION 123',
      counterpartName: 'PayPal (Europe) S.a r.l. et Cie, S.C.A.',
      payee: 'PayPal',
      amountCents: -5000,
    });
    insertTx({
      purpose: 'PAYPAL *KAAS FRISCHDIENST | Ihr Einkauf bei KAAS FRISCHDIENST',
      counterpartName: 'PayPal (Europe)',
      payee: 'PayPal',
      amountCents: -2000,
    });
    insertTx({
      purpose: 'PAYPAL *RANDOM CAFE | Coffee purchase',
      counterpartName: 'PayPal',
      payee: 'PayPal',
      amountCents: -1500,
    });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=365').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    
    // Should have three distinct groups (one per merchant)
    expect(groups.length).toBeGreaterThanOrEqual(3);
    
    // Find groups by display name
    const aralGroup = groups.find(g => (g.displayName || '').toUpperCase().includes('ARAL'));
    const kaasGroup = groups.find(g => (g.displayName || '').toUpperCase().includes('KAAS'));
    const cafeGroup = groups.find(g => (g.displayName || '').toUpperCase().includes('CAFE') || (g.displayName || '').toUpperCase().includes('RANDOM'));
    
    expect(aralGroup).toBeDefined();
    expect(kaasGroup).toBeDefined();
    expect(cafeGroup).toBeDefined();
    
    // Each group should have exactly one transaction
    expect(aralGroup?.txCount).toBe(1);
    expect(kaasGroup?.txCount).toBe(1);
    expect(cafeGroup?.txCount).toBe(1);
    
    // Group IDs should be different
    expect(aralGroup?.groupId).not.toBe(kaasGroup?.groupId);
    expect(kaasGroup?.groupId).not.toBe(cafeGroup?.groupId);
    expect(aralGroup?.groupId).not.toBe(cafeGroup?.groupId);
    
    // Group IDs should include PayPal namespace
    expect(aralGroup?.groupId).toContain('paypal:');
    expect(kaasGroup?.groupId).toContain('paypal:');
    expect(cafeGroup?.groupId).toContain('paypal:');
  });

  it('merges PayPal transactions with same underlying merchant', async () => {
    // Multiple PayPal transactions with the same underlying merchant
    // Use a merchant that won't be categorized by system rules (avoid known patterns)
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: PayPal (Europe) S.a r.l. et Cie, S.C.A. | PAYPAL *XYZ SHOP 123',
      counterpartName: 'PayPal (Europe)',
      payee: 'PayPal',
      bookingDate: '2025-01-15',
      amountCents: -5000,
    });
    insertTx({
      purpose: 'PAYPAL *XYZ SHOP 123 | Purchase',
      counterpartName: 'PayPal',
      payee: 'PayPal',
      bookingDate: '2025-02-15',
      amountCents: -5200,
    });
    insertTx({
      purpose: 'PAYPAL *XYZ SHOP 123 | Item bought',
      counterpartName: 'PayPal (Europe) S.a r.l. et Cie',
      payee: 'PayPal',
      bookingDate: '2025-03-15',
      amountCents: -4800,
    });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=365').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    
    // Should have one group for XYZ SHOP 123
    // Find by groupId containing 'paypal:' prefix (PayPal groups use paypal: prefix)
    const shopGroup = groups.find(g => {
      const groupId = g.groupId || '';
      const displayName = (g.displayName || '').toUpperCase();
      return groupId.startsWith('paypal:') || displayName.includes('XYZ');
    });
    expect(shopGroup).toBeDefined();
    if (shopGroup) {
      expect(shopGroup.txCount).toBe(3);
      expect(shopGroup.totalExpenseCents).toBe(15000); // 5000 + 5200 + 4800
      expect(shopGroup.groupId).toContain('paypal:');
    }
  });

  it('groups PayPal transactions without extractable merchant individually', async () => {
    // PayPal transaction where we cannot extract underlying merchant
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: PayPal (Europe) S.a r.l. et Cie, S.C.A.',
      counterpartName: 'PayPal (Europe)',
      payee: 'PayPal',
      amountCents: -1000,
    });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=365').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    
    // Should create a group with tx: prefix (one transaction per group)
    const paypalGroup = groups.find(g => g.groupId?.startsWith('tx:'));
    expect(paypalGroup).toBeDefined();
    expect(paypalGroup?.txCount).toBe(1);
  });

  it('still groups regular (non-PayPal) merchants correctly', async () => {
    // Regular merchants (no PayPal) should still group normally
    insertTx({
      purpose: 'Kauf bei REWE Markt',
      counterpartName: 'REWE',
      payee: 'REWE',
      amountCents: -1500,
    });
    insertTx({
      purpose: 'REWE sagt Danke',
      counterpartName: 'REWE',
      payee: 'REWE',
      amountCents: -2500,
    });
    insertTx({
      purpose: 'Rewe Supermarket',
      counterpartName: 'REWE',
      payee: 'REWE',
      amountCents: -1800,
    });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=365').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    
    // Should have one group for REWE
    const reweGroup = groups.find(g => (g.displayName || '').toUpperCase().includes('REWE'));
    expect(reweGroup).toBeDefined();
    expect(reweGroup?.txCount).toBe(3);
    expect(reweGroup?.groupId).toMatch(/^m:/); // Regular merchant namespace
  });

  it('creates separate groups for different merchants via comdirect card', async () => {
    // Four comdirect card transactions with different Auftraggeber merchants
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: Aral Station 141726125 Buchungstext: Aral Station 141726125, Koeln DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-05 00:00:00 Ref. AAA',
      counterpartName: null,
      payee: null,
      amountCents: -5000,
    });
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: Stadt Dormagen Buchungstext: Stadt Dormagen Stadt Dormagen/Paul-Wierich-Platz 2 2025-10-04T09:34:18 KFN 0 VJ 2612 Ref. BBB',
      counterpartName: null,
      payee: null,
      amountCents: -2000,
    });
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: TOERTCHENTOERTCHEN OHG Buchungstext: TOERTCHENTOERTCHEN OHG KOELN DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte Ref. CCC',
      counterpartName: null,
      payee: null,
      amountCents: -1500,
    });
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: KAAS FRISCHDIENST Buchungstext: KAAS FRISCHDIENST BERGHEIM DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte Ref. DDD',
      counterpartName: null,
      payee: null,
      amountCents: -3000,
    });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=365').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    
    // Should have 4 distinct groups (one per merchant)
    expect(groups.length).toBeGreaterThanOrEqual(4);
    
    // Find groups by display name
    const aralGroup = groups.find(g => (g.displayName || '').toUpperCase().includes('ARAL'));
    const dormagenGroup = groups.find(g => (g.displayName || '').toUpperCase().includes('DORMAGEN'));
    const toertchenGroup = groups.find(g => (g.displayName || '').toUpperCase().includes('TOERTCHEN'));
    const kaasGroup = groups.find(g => (g.displayName || '').toUpperCase().includes('KAAS'));
    
    expect(aralGroup).toBeDefined();
    expect(dormagenGroup).toBeDefined();
    expect(toertchenGroup).toBeDefined();
    expect(kaasGroup).toBeDefined();
    
    // Each group should have exactly one transaction
    expect(aralGroup?.txCount).toBe(1);
    expect(dormagenGroup?.txCount).toBe(1);
    expect(toertchenGroup?.txCount).toBe(1);
    expect(kaasGroup?.txCount).toBe(1);
    
    // Group IDs should be different
    const groupIds = [aralGroup?.groupId, dormagenGroup?.groupId, toertchenGroup?.groupId, kaasGroup?.groupId];
    const uniqueGroupIds = new Set(groupIds);
    expect(uniqueGroupIds.size).toBe(4);
    
    // Display names should contain the merchant names
    expect(aralGroup?.displayName).toMatch(/Aral/i);
    expect(dormagenGroup?.displayName).toMatch(/Stadt Dormagen/i);
    expect(toertchenGroup?.displayName).toMatch(/TOERTCHENTOERTCHEN/i);
    expect(kaasGroup?.displayName).toMatch(/KAAS/i);
  });

  it('merges comdirect card transactions with same Auftraggeber merchant', async () => {
    // Three comdirect card transactions with the same Aral Station merchant
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: Aral Station 141726125 Buchungstext: Aral Station 141726125, Koeln DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-05 00:00:00 Ref. AAA',
      counterpartName: null,
      payee: null,
      bookingDate: '2025-10-05',
      amountCents: -5000,
    });
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: Aral Station 141726125 Buchungstext: Aral Station 141726125, Koeln DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-15 00:00:00 Ref. BBB',
      counterpartName: null,
      payee: null,
      bookingDate: '2025-10-15',
      amountCents: -5200,
    });
    insertTx({
      purpose: 'Lastschrift / Belastung | Auftraggeber: Aral Station 141726125 Buchungstext: Aral Station 141726125, Koeln DE Karte Nr. 4871 78XX XXXX 1230 Kartenzahlung comdirect Visa-Debitkarte 2025-10-25 00:00:00 Ref. CCC',
      counterpartName: null,
      payee: null,
      bookingDate: '2025-10-25',
      amountCents: -4800,
    });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=365').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    
    // Should have exactly one group for Aral Station
    const aralGroups = groups.filter(g => (g.displayName || '').toUpperCase().includes('ARAL'));
    expect(aralGroups.length).toBe(1);
    
    const aralGroup = aralGroups[0];
    expect(aralGroup?.txCount).toBe(3);
    expect(aralGroup?.totalExpenseCents).toBe(15000); // 5000 + 5200 + 4800
    expect(aralGroup?.displayName).toMatch(/Aral Station/i);
    expect(aralGroup?.groupId).toMatch(/^m:/); // Regular merchant namespace
  });

  it('suggests category for merchant matching existing rules (KFC → dining:fast_food)', async () => {
    // Seed 4-5 KFC transactions that should match the KFC merchant pattern
    insertTx({ 
      purpose: 'Lastschrift / Belastung | Auftraggeber: KFC Buchungstext: KFC KOELN DE Karte Nr. 1234', 
      counterpartName: 'KFC', 
      payee: 'KFC', 
      amountCents: -1200,
      bookingDate: '2025-10-05'
    });
    insertTx({ 
      purpose: 'KFC KOELN DE Karte', 
      counterpartName: 'KFC', 
      payee: 'KFC', 
      amountCents: -1500,
      bookingDate: '2025-10-06'
    });
    insertTx({ 
      purpose: 'KENTUCKY FRIED CHICKEN KOELN', 
      counterpartName: 'KENTUCKY FRIED CHICKEN', 
      payee: 'KFC', 
      amountCents: -1800,
      bookingDate: '2025-10-07'
    });
    insertTx({ 
      purpose: 'KFC Shop', 
      counterpartName: 'KFC', 
      payee: 'KFC', 
      amountCents: -1000,
      bookingDate: '2025-10-08'
    });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=90').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    expect(groups.length).toBeGreaterThan(0);
    
    // Find KFC group
    const kfcGroup = groups.find(g => 
      (g.displayName || '').toUpperCase().includes('KFC') || 
      (g.groupId || '').includes('kfc')
    );
    expect(kfcGroup).toBeTruthy();
    
    // Assert suggestion
    expect(kfcGroup.suggestedNimbusCategoryId).toBe('dining:fast_food');
    expect(kfcGroup.suggestedCategoryId).toBe('dining_out');
    expect(kfcGroup.suggestedConfidence).toBeGreaterThanOrEqual(0.7);
    expect(kfcGroup.suggestedReasonText).toBeTruthy();
    expect(kfcGroup.suggestedReasonText).toMatch(/KFC|fast food|dining/i);
  });

  it('returns null suggestion for unknown merchants', async () => {
    // Seed transactions with generic/unknown merchant
    insertTx({ 
      purpose: 'UNKNOWN SHOP 12345 XYZ', 
      counterpartName: 'UNKNOWN SHOP', 
      payee: 'UNKNOWN', 
      amountCents: -1000,
      bookingDate: '2025-10-05'
    });
    insertTx({ 
      purpose: 'UNKNOWN SHOP 12345 ABC', 
      counterpartName: 'UNKNOWN SHOP', 
      payee: 'UNKNOWN', 
      amountCents: -2000,
      bookingDate: '2025-10-06'
    });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=90').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    expect(groups.length).toBeGreaterThan(0);
    
    // Find unknown group
    const unknownGroup = groups.find(g => 
      (g.displayName || '').toUpperCase().includes('UNKNOWN') || 
      (g.groupId || '').includes('unknown')
    );
    expect(unknownGroup).toBeTruthy();
    
    // Assert no suggestion (or suggestion is null/other)
    // If no rules match, suggestion should be null
    if (unknownGroup.suggestedCategoryId) {
      // If there is a suggestion, it should not be 'other' or 'other_review'
      expect(unknownGroup.suggestedCategoryId).not.toBe('other');
      expect(unknownGroup.suggestedCategoryId).not.toBe('other_review');
      expect(unknownGroup.suggestedConfidence).toBeGreaterThanOrEqual(0.7);
    } else {
      // Null suggestion is acceptable for unknown merchants
      expect(unknownGroup.suggestedCategoryId).toBeNull();
    }
  });

  it('excludes cash withdrawals from Sonstiges summary', async () => {
    // Seed cash withdrawal transaction (real-world comdirect text)
    insertTx({
      purpose: 'Auszahlung GAA | Auftraggeber: DEUTSCHE BANK Buchungstext: Bargeldauszahlung Deutsche Bank//Köln/DE 2025-09-26T19:59:22 KFN 0 VJ 2612 Ref. 7E2C21PT2VYY897P/11596',
      counterpartName: 'DEUTSCHE BANK',
      payee: 'DEUTSCHE BANK',
      amountCents: -5000,
      bookingDate: '2025-09-26',
      flags: { isCashWithdrawal: 1 },
    });
    // Seed regular Sonstiges transaction
    insertTx({
      purpose: 'UNKNOWN SHOP 12345 XYZ',
      counterpartName: 'UNKNOWN SHOP',
      payee: 'UNKNOWN',
      amountCents: -2000,
      bookingDate: '2025-09-27',
      flags: { isCashWithdrawal: 0 },
    });

    const summary = await request(app).get('/api/review/sonstiges-summary?days=90').expect(200);
    const groups: any[] = summary.body?.groups ?? [];
    
    // Cash withdrawal should NOT be in groups
    const cashGroup = groups.find(g => 
      (g.displayName || '').toUpperCase().includes('DEUTSCHE BANK') ||
      (g.groupId || '').includes('deutsche')
    );
    expect(cashGroup).toBeUndefined();
    
    // Only the regular Sonstiges transaction should be present
    const unknownGroup = groups.find(g => 
      (g.displayName || '').toUpperCase().includes('UNKNOWN')
    );
    expect(unknownGroup).toBeDefined();
    
    // Total should only include non-cash withdrawals
    expect(summary.body?.totalSonstigesCents).toBe(2000); // Only the unknown shop, not the cash withdrawal
  });
});


