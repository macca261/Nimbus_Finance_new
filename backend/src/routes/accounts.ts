import { Router } from 'express';
import type { Account, AccountRole } from '../types/core';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const filePath = process.env.NIMBUS_DB_PATH || process.env.DB_FILE || 'nimbus.db';
const fallbackDb = new BetterSqlite3(filePath);
export const accountsRouter = Router();

function getConnection(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null) || fallbackDb;
}

const ROLES: AccountRole[] = ['spending', 'savings', 'wallet'];
function isValidRole(v: any): v is AccountRole {
  return typeof v === 'string' && ROLES.includes(v as AccountRole);
}

// GET /api/accounts
accountsRouter.get('/', (req, res) => {
  try {
    const db = getConnection(req);
    const rows = db.prepare(`SELECT id, iban, name, role, createdAt FROM accounts ORDER BY createdAt DESC`).all() as Array<any>;
    const data: Account[] = rows.map(r => ({
      id: String(r.id),
      iban: r.iban ?? null,
      name: r.name ?? null,
      role: (r.role as AccountRole) ?? 'spending',
      createdAt: r.createdAt,
    }));
    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load accounts' });
  }
});

// POST /api/accounts (create)
accountsRouter.post('/', (req, res) => {
  try {
    const db = getConnection(req);
    const { id, iban, name, role } = req.body || {};
    const accountId = typeof id === 'string' && id.trim() ? id.trim() : null;
    if (!accountId) return res.status(400).json({ error: 'id is required' });
    const roleVal: AccountRole = isValidRole(role) ? role : 'spending';
    const stmt = db.prepare(`INSERT INTO accounts (id, iban, name, role) VALUES (?, ?, ?, ?)`);
    stmt.run(accountId, typeof iban === 'string' ? iban : null, typeof name === 'string' ? name : null, roleVal);
    res.json({ ok: true, account: { id: accountId, iban: iban ?? null, name: name ?? null, role: roleVal } });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PATCH /api/accounts/:id (update role and metadata)
accountsRouter.patch('/:id', (req, res) => {
  try {
    const db = getConnection(req);
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const { role, name, iban } = req.body || {};
    const updates: string[] = [];
    const params: any[] = [];
    if (typeof name === 'string') {
      updates.push('name = ?'); params.push(name);
    }
    if (typeof iban === 'string') {
      updates.push('iban = ?'); params.push(iban);
    }
    if (typeof role !== 'undefined') {
      if (!isValidRole(role)) return res.status(400).json({ error: 'invalid role' });
      updates.push('role = ?'); params.push(role);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'nothing to update' });
    params.push(id);
    const sql = `UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`;
    const r = db.prepare(sql).run(...params);
    if (!r.changes) return res.status(404).json({ error: 'account not found' });
    const row = db.prepare(`SELECT id, iban, name, role, createdAt FROM accounts WHERE id = ?`).get(id) as any;
    res.json({ ok: true, account: { id: row.id, iban: row.iban ?? null, name: row.name ?? null, role: row.role ?? 'spending', createdAt: row.createdAt } as Account });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});


