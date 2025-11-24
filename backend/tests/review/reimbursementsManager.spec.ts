import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server';
import type { Database } from '../../src/db';
import { openDb, ensureSchema } from '../../src/db';

describe('Reimbursements Manager', () => {
  let app: any;
  let db: Database;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB = '1';
    db = openDb();
    ensureSchema(db);
    app = createApp({ db } as any);
  });

  function insertTransaction(p: Partial<{
    bookingDate: string;
    amountCents: number;
    purpose: string;
    counterpartName: string;
    payee: string;
    category: string;
    reimbursementGroupId: string | null;
    isReimbursement: number;
    isPassThrough: number;
    reimbursementRole: string | null;
  }>) {
    const {
      bookingDate = '2025-01-15',
      amountCents = -10000,
      purpose = 'Test transaction',
      counterpartName = 'Test Counterpart',
      payee = 'TEST',
      category = 'other',
      reimbursementGroupId = null,
      isReimbursement = 0,
      isPassThrough = 0,
      reimbursementRole = null,
    } = p;

    const stmt = db.prepare(`
      INSERT INTO transactions (
        bookingDate, valueDate, amountCents, currency, purpose, counterpartName, payee, category,
        isReimbursement, reimbursementRole, reimbursementGroupId, isPassThrough
      )
      VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      bookingDate,
      bookingDate,
      amountCents,
      purpose,
      counterpartName,
      payee,
      category,
      isReimbursement,
      reimbursementRole,
      reimbursementGroupId,
      isPassThrough,
    );
  }

  it('groups P2P reimbursements by reimbursementGroupId', async () => {
    const groupId = 'rb_pembe_123';
    
    // Payer (negative)
    insertTransaction({
      bookingDate: '2025-01-15',
      amountCents: -10000,
      purpose: 'Handyzahlung Pembe Aksoy',
      counterpartName: 'Pembe Aksoy',
      payee: 'Pembe Aksoy',
      isReimbursement: 1,
      reimbursementRole: 'payer',
      reimbursementGroupId: groupId,
    });

    // Receiver (positive)
    insertTransaction({
      bookingDate: '2025-01-20',
      amountCents: 10000,
      purpose: 'Pembe Aksoy',
      counterpartName: 'Pembe Aksoy',
      payee: 'Pembe Aksoy',
      isReimbursement: 1,
      reimbursementRole: 'receiver',
      reimbursementGroupId: groupId,
    });

    const res = await request(app).get('/api/review/reimbursements').expect(200);
    const groups = res.body?.groups ?? [];

    expect(groups.length).toBe(1);
    const group = groups[0];

    expect(group.groupId).toBe(groupId);
    expect(group.counterpartName).toBe('Pembe Aksoy');
    expect(group.txCount).toBe(2);
    expect(group.totalInflowCents).toBe(10000);
    expect(group.totalOutflowCents).toBe(10000);
    expect(group.inflows.length).toBe(1);
    expect(group.outflows.length).toBe(1);
    expect(group.inflows[0].amountCents).toBe(10000);
    expect(group.outflows[0].amountCents).toBe(-10000);
    // Confidence should be present and in valid range
    expect(group.confidence).toBeDefined();
    expect(typeof group.confidence).toBe('number');
    expect(group.confidence).toBeGreaterThanOrEqual(0);
    expect(group.confidence).toBeLessThanOrEqual(100);
    // Net effect fields should be present
    expect(group.totalExpenseCents).toBeDefined();
    expect(group.netImpactCents).toBeDefined();
  });

  it('calculates net effect correctly for group with expenses and incoming reimbursement', async () => {
    const groupId = 'rb_test_net_1';
    
    // Two underlying expenses (negative amounts, not marked as reimbursement)
    insertTransaction({
      bookingDate: '2025-01-10',
      amountCents: -5000, // -50.00 EUR
      purpose: 'Expense 1',
      counterpartName: 'Test Merchant',
      payee: 'Test Merchant',
      category: 'shopping',
      reimbursementGroupId: groupId,
      isReimbursement: 0, // Not a reimbursement, this is the original expense
      isPassThrough: 0,
    });

    insertTransaction({
      bookingDate: '2025-01-12',
      amountCents: -3000, // -30.00 EUR
      purpose: 'Expense 2',
      counterpartName: 'Test Merchant',
      payee: 'Test Merchant',
      category: 'shopping',
      reimbursementGroupId: groupId,
      isReimbursement: 0, // Not a reimbursement, this is the original expense
      isPassThrough: 0,
    });

    // One incoming reimbursement (positive amount, user is receiver)
    insertTransaction({
      bookingDate: '2025-01-15',
      amountCents: 7000, // +70.00 EUR (reimbursement)
      purpose: 'Rückbuchung',
      counterpartName: 'Test Merchant',
      payee: 'Test Merchant',
      isReimbursement: 1,
      reimbursementRole: 'receiver',
      reimbursementGroupId: groupId,
      isPassThrough: 0,
    });

    const res = await request(app).get('/api/review/reimbursements').expect(200);
    const groups = res.body?.groups ?? [];

    expect(groups.length).toBe(1);
    const group = groups[0];

    // totalExpenseCents: 5000 + 3000 = 8000 (expenses as positive cents)
    expect(group.totalExpenseCents).toBe(8000);
    // totalInflowCents: 7000 (incoming reimbursement)
    expect(group.totalInflowCents).toBe(7000);
    // totalOutflowCents: 0 (no outgoing reimbursements)
    expect(group.totalOutflowCents).toBe(0);
    // netImpactCents: 8000 - 7000 + 0 = 1000 (user paid 10 EUR net)
    expect(group.netImpactCents).toBe(1000);
  });

  it('calculates net effect correctly with both incoming and outgoing reimbursements', async () => {
    const groupId = 'rb_test_net_2';
    
    // One underlying expense
    insertTransaction({
      bookingDate: '2025-01-10',
      amountCents: -10000, // -100.00 EUR
      purpose: 'Original Expense',
      counterpartName: 'Friend',
      payee: 'Friend',
      category: 'other',
      reimbursementGroupId: groupId,
      isReimbursement: 0,
      isPassThrough: 0,
    });

    // Incoming reimbursement (user received money back)
    insertTransaction({
      bookingDate: '2025-01-15',
      amountCents: 6000, // +60.00 EUR
      purpose: 'Erstattung',
      counterpartName: 'Friend',
      payee: 'Friend',
      isReimbursement: 1,
      reimbursementRole: 'receiver',
      reimbursementGroupId: groupId,
      isPassThrough: 0,
    });

    // Outgoing reimbursement (user paid out money)
    insertTransaction({
      bookingDate: '2025-01-16',
      amountCents: -2000, // -20.00 EUR (user paid out)
      purpose: 'Zahlung',
      counterpartName: 'Friend',
      payee: 'Friend',
      isReimbursement: 1,
      reimbursementRole: 'payer',
      reimbursementGroupId: groupId,
      isPassThrough: 0,
    });

    const res = await request(app).get('/api/review/reimbursements').expect(200);
    const groups = res.body?.groups ?? [];

    expect(groups.length).toBe(1);
    const group = groups[0];

    // totalExpenseCents: 10000 (original expense as positive cents)
    expect(group.totalExpenseCents).toBe(10000);
    // totalInflowCents: 6000 (incoming reimbursement)
    expect(group.totalInflowCents).toBe(6000);
    // totalOutflowCents: 2000 (outgoing reimbursement as positive cents)
    expect(group.totalOutflowCents).toBe(2000);
    // netImpactCents: 10000 - 6000 + 2000 = 6000 (user paid 60 EUR net)
    expect(group.netImpactCents).toBe(6000);
  });

  it('excludes pass-through transactions from groups', async () => {
    const groupId = 'rb_test_456';
    
    // Payer (not pass-through)
    insertTransaction({
      bookingDate: '2025-01-15',
      amountCents: -10000,
      purpose: 'Payment',
      counterpartName: 'Test Person',
      payee: 'Test Person',
      isReimbursement: 1,
      reimbursementRole: 'payer',
      reimbursementGroupId: groupId,
      isPassThrough: 0,
    });

    // Receiver (pass-through - should be excluded)
    insertTransaction({
      bookingDate: '2025-01-20',
      amountCents: 10000,
      purpose: 'Refund',
      counterpartName: 'Test Person',
      payee: 'Test Person',
      isReimbursement: 1,
      reimbursementRole: 'receiver',
      reimbursementGroupId: groupId,
      isPassThrough: 1, // Already marked as pass-through
    });

    const res = await request(app).get('/api/review/reimbursements').expect(200);
    const groups = res.body?.groups ?? [];

    // Group should only contain the non-pass-through transaction
    expect(groups.length).toBe(1);
    const group = groups[0];
    expect(group.txCount).toBe(1);
    expect(group.outflows.length).toBe(1);
    expect(group.inflows.length).toBe(0);
  });

  it('excludes groups where all transactions are pass-through', async () => {
    const groupId = 'rb_all_passthrough';
    
    // Both transactions are pass-through
    insertTransaction({
      bookingDate: '2025-01-15',
      amountCents: -10000,
      purpose: 'Payment',
      counterpartName: 'Test Person',
      payee: 'Test Person',
      isReimbursement: 1,
      reimbursementRole: 'payer',
      reimbursementGroupId: groupId,
      isPassThrough: 1,
    });

    insertTransaction({
      bookingDate: '2025-01-20',
      amountCents: 10000,
      purpose: 'Refund',
      counterpartName: 'Test Person',
      payee: 'Test Person',
      isReimbursement: 1,
      reimbursementRole: 'receiver',
      reimbursementGroupId: groupId,
      isPassThrough: 1,
    });

    const res = await request(app).get('/api/review/reimbursements').expect(200);
    const groups = res.body?.groups ?? [];

    // Group should not appear since all transactions are pass-through
    expect(groups.length).toBe(0);
  });

  it('groups by fallback key when reimbursementGroupId is missing', async () => {
    // Two transactions with same counterpartName but no reimbursementGroupId
    insertTransaction({
      bookingDate: '2025-01-15',
      amountCents: -5000,
      purpose: 'Payment to Friend',
      counterpartName: 'Max Mustermann',
      payee: 'Max Mustermann',
      isReimbursement: 1,
      reimbursementRole: 'payer',
      reimbursementGroupId: null, // No group ID
      isPassThrough: 0,
    });

    insertTransaction({
      bookingDate: '2025-01-20',
      amountCents: 5000,
      purpose: 'Refund from Friend',
      counterpartName: 'Max Mustermann',
      payee: 'Max Mustermann',
      isReimbursement: 1,
      reimbursementRole: 'receiver',
      reimbursementGroupId: null, // No group ID
      isPassThrough: 0,
    });

    const res = await request(app).get('/api/review/reimbursements').expect(200);
    const groups = res.body?.groups ?? [];

    // Should be grouped together by normalized counterpartName
    expect(groups.length).toBe(1);
    const group = groups[0];
    expect(group.counterpartName).toBe('Max Mustermann');
    expect(group.txCount).toBe(2);
    expect(group.groupId).toMatch(/^rb_fallback:/);
  });

  it('sorts groups by lastBookingDate descending', async () => {
    const group1 = 'rb_group1';
    const group2 = 'rb_group2';

    // Group 1: older
    insertTransaction({
      bookingDate: '2025-01-10',
      amountCents: -10000,
      purpose: 'Payment 1',
      counterpartName: 'Person A',
      payee: 'Person A',
      isReimbursement: 1,
      reimbursementRole: 'payer',
      reimbursementGroupId: group1,
    });

    // Group 2: newer
    insertTransaction({
      bookingDate: '2025-01-25',
      amountCents: -20000,
      purpose: 'Payment 2',
      counterpartName: 'Person B',
      payee: 'Person B',
      isReimbursement: 1,
      reimbursementRole: 'payer',
      reimbursementGroupId: group2,
    });

    const res = await request(app).get('/api/review/reimbursements').expect(200);
    const groups = res.body?.groups ?? [];

    expect(groups.length).toBe(2);
    // Newer group should come first
    expect(groups[0].groupId).toBe(group2);
    expect(groups[0].lastBookingDate).toBe('2025-01-25');
    expect(groups[1].groupId).toBe(group1);
    expect(groups[1].lastBookingDate).toBe('2025-01-10');
  });

  it('limits preview arrays to 5 items each', async () => {
    const groupId = 'rb_many_tx';
    
    // Create 7 inflows
    for (let i = 0; i < 7; i++) {
      insertTransaction({
        bookingDate: `2025-01-${15 + i}`,
        amountCents: 1000,
        purpose: `Inflow ${i}`,
        counterpartName: 'Test',
        payee: 'Test',
        isReimbursement: 1,
        reimbursementRole: 'receiver',
        reimbursementGroupId: groupId,
      });
    }

    // Create 6 outflows
    for (let i = 0; i < 6; i++) {
      insertTransaction({
        bookingDate: `2025-01-${10 + i}`,
        amountCents: -1000,
        purpose: `Outflow ${i}`,
        counterpartName: 'Test',
        payee: 'Test',
        isReimbursement: 1,
        reimbursementRole: 'payer',
        reimbursementGroupId: groupId,
      });
    }

    const res = await request(app).get('/api/review/reimbursements').expect(200);
    const groups = res.body?.groups ?? [];

    expect(groups.length).toBe(1);
    const group = groups[0];
    expect(group.txCount).toBe(13); // All transactions counted
    expect(group.inflows.length).toBe(5); // Limited to 5
    expect(group.outflows.length).toBe(5); // Limited to 5
  });

  it('respects 90-day time window', async () => {
    const groupId = 'rb_old';
    
    // Transaction older than 90 days
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 100);
    const oldDateStr = oldDate.toISOString().split('T')[0];

    insertTransaction({
      bookingDate: oldDateStr,
      amountCents: -10000,
      purpose: 'Old payment',
      counterpartName: 'Old Person',
      payee: 'Old Person',
      isReimbursement: 1,
      reimbursementRole: 'payer',
      reimbursementGroupId: groupId,
    });

    // Recent transaction
    insertTransaction({
      bookingDate: '2025-01-20',
      amountCents: 10000,
      purpose: 'Recent refund',
      counterpartName: 'Recent Person',
      payee: 'Recent Person',
      isReimbursement: 1,
      reimbursementRole: 'receiver',
      reimbursementGroupId: 'rb_recent',
    });

    const res = await request(app).get('/api/review/reimbursements').expect(200);
    const groups = res.body?.groups ?? [];

    // Only recent transaction should appear
    expect(groups.length).toBe(1);
    expect(groups[0].groupId).toBe('rb_recent');
  });

  it('ignores reimbursement group when ignore endpoint is called', async () => {
    const groupId = 'rb_test_ignore';
    
    // Create a reimbursement group
    insertTransaction({
      bookingDate: '2025-01-15',
      amountCents: -10000,
      purpose: 'Payment',
      counterpartName: 'Test Person',
      payee: 'TEST',
      isReimbursement: 1,
      reimbursementRole: 'payer',
      reimbursementGroupId: groupId,
    });

    insertTransaction({
      bookingDate: '2025-01-20',
      amountCents: 10000,
      purpose: 'Refund',
      counterpartName: 'Test Person',
      payee: 'TEST',
      isReimbursement: 1,
      reimbursementRole: 'receiver',
      reimbursementGroupId: groupId,
    });

    // Verify group exists
    let res = await request(app).get('/api/review/reimbursements').expect(200);
    let groups = res.body?.groups ?? [];
    expect(groups.length).toBe(1);
    expect(groups[0].groupId).toBe(groupId);

    // Ignore the group
    await request(app)
      .post(`/api/review/reimbursements/${groupId}/ignore`)
      .expect(200);

    // Verify group no longer appears
    res = await request(app).get('/api/review/reimbursements').expect(200);
    groups = res.body?.groups ?? [];
    expect(groups.length).toBe(0);
  });
});

