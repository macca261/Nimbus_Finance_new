import { Router } from 'express';
import type { Request, Response } from 'express';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import * as accountsService from '../services/accountsService';

const filePath = process.env.NIMBUS_DB_PATH || process.env.DB_FILE || 'nimbus.db';
const fallbackDb = new BetterSqlite3(filePath);
export const accountsRouter = Router();

function getConnection(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null) || fallbackDb;
}

// GET /api/accounts
accountsRouter.get('/', (req: Request, res: Response) => {
  try {
    const db = getConnection(req);
    const includeArchived = req.query.includeArchived === 'true';
    const accounts = accountsService.listAccounts(db, { includeArchived });
    res.json({ data: accounts });
  } catch (error: any) {
    console.error('[accounts] GET / error:', error);
    res.status(500).json({ error: 'Failed to load accounts', message: error?.message });
  }
});

// POST /api/accounts (create)
accountsRouter.post('/', (req: Request, res: Response) => {
  try {
    const db = getConnection(req);
    const { name, type, iban, accountNumber, isPrimary } = req.body || {};
    
    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Account name is required' });
    }
    
    if (!type || !accountsService.isValidAccountType(type)) {
      return res.status(400).json({ error: 'Valid account type is required (CHECKING, SAVINGS, CREDIT_CARD, CASH, OTHER)' });
    }

    const account = accountsService.createAccount(db, {
      name: name.trim(),
      type,
      iban: iban || null,
      accountNumber: accountNumber || null,
      isPrimary: Boolean(isPrimary),
    });

    res.status(201).json({ ok: true, account });
  } catch (error: any) {
    console.error('[accounts] POST / error:', error);
    if (error.message === 'Account name is required' || error.message.includes('Invalid account type')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create account', message: error?.message });
  }
});

// PUT /api/accounts/:id (update account)
accountsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getConnection(req);
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const { name, type, iban, accountNumber, isPrimary } = req.body || {};
    
    // Build update input (only include provided fields)
    const updateInput: accountsService.UpdateAccountInput = {};
    if (name !== undefined) updateInput.name = name;
    if (type !== undefined) updateInput.type = type;
    if (iban !== undefined) updateInput.iban = iban;
    if (accountNumber !== undefined) updateInput.accountNumber = accountNumber;
    if (isPrimary !== undefined) updateInput.isPrimary = isPrimary;

    if (Object.keys(updateInput).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const account = accountsService.updateAccount(db, id, updateInput);
    res.json({ ok: true, account });
  } catch (error: any) {
    console.error('[accounts] PUT /:id error:', error);
    if (error.message === 'Account not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Invalid account type') || error.message.includes('cannot be empty')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update account', message: error?.message });
  }
});

// DELETE /api/accounts/:id (soft delete/archive)
accountsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getConnection(req);
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    accountsService.deleteAccount(db, id);
    res.json({ ok: true, message: 'Account deleted' });
  } catch (error: any) {
    console.error('[accounts] DELETE /:id error:', error);
    if (error.message === 'Account not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete account', message: error?.message });
  }
});


