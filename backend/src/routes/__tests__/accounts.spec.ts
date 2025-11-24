import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { accountsRouter } from '../accounts';
import { ensureSchema } from '../../db';

describe('Accounts API', () => {
  let app: express.Application;
  let db: BetterSqliteDatabase;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    ensureSchema(db);
    
    app = express();
    app.use(express.json());
    (app as any).locals = { db };
    app.use('/api/accounts', accountsRouter);
  });

  afterEach(() => {
    db.close();
  });

  it('GET /api/accounts should return empty array when no accounts exist', async () => {
    const res = await request(app).get('/api/accounts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('GET /api/accounts should return accounts after creation', async () => {
    // Create an account
    const createRes = await request(app)
      .post('/api/accounts')
      .send({
        name: 'Test Account',
        type: 'CHECKING',
        iban: 'DE89370400440532013000',
      });
    
    expect(createRes.status).toBe(201);
    expect(createRes.body.account).toBeTruthy();

    // List accounts
    const listRes = await request(app).get('/api/accounts');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].name).toBe('Test Account');
  });

  it('POST /api/accounts should create account with valid data', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({
        name: 'Sparkonto',
        type: 'SAVINGS',
        iban: 'DE89370400440532013001',
        accountNumber: '123456',
        isPrimary: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.account).toBeTruthy();
    expect(res.body.account.name).toBe('Sparkonto');
    expect(res.body.account.type).toBe('SAVINGS');
    expect(res.body.account.isPrimary).toBe(true);
  });

  it('POST /api/accounts should return 400 for invalid account type', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({
        name: 'Test',
        type: 'INVALID_TYPE',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Valid account type');
  });

  it('PUT /api/accounts/:id should update account', async () => {
    // Create account
    const createRes = await request(app)
      .post('/api/accounts')
      .send({ name: 'Old Name', type: 'CHECKING' });
    
    const accountId = createRes.body.account.id;

    // Update account
    const updateRes = await request(app)
      .put(`/api/accounts/${accountId}`)
      .send({ name: 'New Name' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.account.name).toBe('New Name');
  });

  it('DELETE /api/accounts/:id should delete account', async () => {
    // Create account
    const createRes = await request(app)
      .post('/api/accounts')
      .send({ name: 'To Delete', type: 'CHECKING' });
    
    const accountId = createRes.body.account.id;

    // Delete account
    const deleteRes = await request(app)
      .delete(`/api/accounts/${accountId}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.ok).toBe(true);

    // Verify it's gone
    const listRes = await request(app).get('/api/accounts');
    expect(listRes.body.data.length).toBe(0);
  });
});

