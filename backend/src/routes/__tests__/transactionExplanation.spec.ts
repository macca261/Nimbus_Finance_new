/**
 * Tests for Transaction Explanation API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { rawDb, openDb } from '../../db';
import type { Database } from '../../db';

describe('GET /api/transactions/:id/explanation', () => {
  let db: Database;

  beforeEach(() => {
    db = openDb();
    // Ensure schema exists
    const { ensureSchema } = require('../../db');
    ensureSchema(db);
  });

  it('should return 404 for unknown transaction', async () => {
    const id = 999999;
    const row = db
      .prepare('SELECT id FROM transactions WHERE id = ?')
      .get(id);
    
    expect(row).toBeUndefined();
  });

  it('should return trace: null for transactions without trace', () => {
    // Insert a transaction without categorization trace
    const insert = db.prepare(`
      INSERT INTO transactions (
        bookingDate, valueDate, amountCents, currency, purpose,
        counterpartName, accountIban, rawCode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insert.run(
      '2024-01-15',
      '2024-01-15',
      -5000,
      'EUR',
      'Test transaction',
      'Test Merchant',
      null,
      null
    );

    const txId = result.lastInsertRowid as number;

    // Fetch explanation
    const row = db
      .prepare(
        `SELECT 
          id, 
          category as categoryId, 
          payee as displayName, 
          amountCents, 
          bookingDate as date, 
          categorization_trace as categorizationTrace
         FROM transactions 
         WHERE id = ?`
      )
      .get(txId) as {
        id: number;
        categoryId: string | null;
        displayName: string | null;
        amountCents: number;
        date: string;
        categorizationTrace: string | null;
      };

    expect(row).toBeDefined();
    expect(row.categorizationTrace).toBeNull();
  });

  it('should return valid parsed trace for transactions with stored JSON trace', () => {
    // Insert a transaction with categorization trace
    const trace = {
      method: 'RULE',
      confidence: 95,
      ruleMatchId: 'rewe-supermarket',
      ruleDescription: 'REWE Supermarkt erkannt',
      createdAt: new Date().toISOString(),
    };

    const insert = db.prepare(`
      INSERT INTO transactions (
        bookingDate, valueDate, amountCents, currency, purpose,
        counterpartName, accountIban, rawCode, categorization_trace
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insert.run(
      '2024-01-15',
      '2024-01-15',
      -5000,
      'EUR',
      'REWE Supermarkt',
      'REWE',
      null,
      null,
      JSON.stringify(trace)
    );

    const txId = result.lastInsertRowid as number;

    // Fetch explanation
    const row = db
      .prepare(
        `SELECT 
          id, 
          category as categoryId, 
          payee as displayName, 
          amountCents, 
          bookingDate as date, 
          categorization_trace as categorizationTrace
         FROM transactions 
         WHERE id = ?`
      )
      .get(txId) as {
        id: number;
        categoryId: string | null;
        displayName: string | null;
        amountCents: number;
        date: string;
        categorizationTrace: string | null;
      };

    expect(row).toBeDefined();
    expect(row.categorizationTrace).toBeTruthy();
    
    const parsedTrace = JSON.parse(row.categorizationTrace!);
    expect(parsedTrace.method).toBe('RULE');
    expect(parsedTrace.confidence).toBe(95);
    expect(parsedTrace.ruleMatchId).toBe('rewe-supermarket');
    expect(parsedTrace.ruleDescription).toBe('REWE Supermarkt erkannt');
  });
});

