/**
 * Buckets (Virtual Envelopes) API Routes
 * 
 * Manages "Soft Savings" - virtual partitioning of funds within
 * the main checking account. These are logical allocations that don't
 * require physical transfers.
 */

import { Router } from 'express';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import crypto from 'node:crypto';

const filePath = process.env.NIMBUS_DB_PATH || process.env.DB_FILE || 'nimbus.db';
const fallbackDb = new BetterSqlite3(filePath);

export const bucketsRouter = Router();

function getDb(req: any): BetterSqliteDatabase {
  return ((req.app as any)?.locals?.db ?? null) || fallbackDb;
}

// GET /api/buckets
bucketsRouter.get('/', async (req, res) => {
  try {
    const db = getDb(req);
    const buckets = db.prepare(`
      SELECT 
        id, name, target_amount_cents, target_date,
        current_balance_cents, gamification_asset_id, is_hidden,
        created_at, updated_at
      FROM buckets
      WHERE is_hidden = 0
      ORDER BY created_at DESC
    `).all();

    res.json({ data: buckets });
  } catch (e: any) {
    console.error('[buckets] GET error:', e);
    res.status(500).json({ error: e?.message || 'Failed to load buckets' });
  }
});

// GET /api/buckets/:id
bucketsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb(req);
    const bucket = db.prepare(`
      SELECT 
        id, name, target_amount_cents, target_date,
        current_balance_cents, gamification_asset_id, is_hidden,
        created_at, updated_at
      FROM buckets
      WHERE id = ?
    `).get(id);

    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    res.json({ data: bucket });
  } catch (e: any) {
    console.error('[buckets] GET :id error:', e);
    res.status(500).json({ error: e?.message || 'Failed to load bucket' });
  }
});

// POST /api/buckets
bucketsRouter.post('/', async (req, res) => {
  try {
    const { name, target_amount_cents, target_date, gamification_asset_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }

    const db = getDb(req);
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO buckets (
        id, name, target_amount_cents, target_date,
        current_balance_cents, gamification_asset_id, is_hidden,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, name, target_amount_cents || null, target_date || null, gamification_asset_id || null);

    const bucket = db.prepare(`
      SELECT 
        id, name, target_amount_cents, target_date,
        current_balance_cents, gamification_asset_id, is_hidden,
        created_at, updated_at
      FROM buckets
      WHERE id = ?
    `).get(id);

    res.status(201).json({ data: bucket });
  } catch (e: any) {
    console.error('[buckets] POST error:', e);
    res.status(500).json({ error: e?.message || 'Failed to create bucket' });
  }
});

// PATCH /api/buckets/:id
bucketsRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, target_amount_cents, target_date, gamification_asset_id, is_hidden } = req.body;

    const db = getDb(req);
    const updateFields: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (target_amount_cents !== undefined) {
      updateFields.push('target_amount_cents = ?');
      params.push(target_amount_cents);
    }
    if (target_date !== undefined) {
      updateFields.push('target_date = ?');
      params.push(target_date);
    }
    if (gamification_asset_id !== undefined) {
      updateFields.push('gamification_asset_id = ?');
      params.push(gamification_asset_id);
    }
    if (is_hidden !== undefined) {
      updateFields.push('is_hidden = ?');
      params.push(is_hidden ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`
      UPDATE buckets
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...params);

    const bucket = db.prepare(`
      SELECT 
        id, name, target_amount_cents, target_date,
        current_balance_cents, gamification_asset_id, is_hidden,
        created_at, updated_at
      FROM buckets
      WHERE id = ?
    `).get(id);

    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    res.json({ data: bucket });
  } catch (e: any) {
    console.error('[buckets] PATCH error:', e);
    res.status(500).json({ error: e?.message || 'Failed to update bucket' });
  }
});

// POST /api/buckets/:id/movements
bucketsRouter.post('/:id/movements', async (req, res) => {
  try {
    const { id: bucketId } = req.params;
    const { amount_cents, memo, origin_type, origin_id, date } = req.body;

    if (!amount_cents) {
      return res.status(400).json({ error: 'Missing required field: amount_cents' });
    }

    const db = getDb(req);

    // Check bucket exists
    const bucket = db.prepare('SELECT id, current_balance_cents FROM buckets WHERE id = ?').get(bucketId);
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    // Create movement
    const movementId = crypto.randomUUID();
    const movementDate = date || new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO bucket_movements (
        id, bucket_id, date, amount_cents, memo,
        origin_type, origin_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      movementId,
      bucketId,
      movementDate,
      amount_cents,
      memo || null,
      origin_type || 'MANUAL',
      origin_id || null
    );

    // Update bucket balance
    const newBalance = ((bucket as any).current_balance_cents || 0) + amount_cents;
    db.prepare(`
      UPDATE buckets
      SET current_balance_cents = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newBalance, bucketId);

    const movement = db.prepare(`
      SELECT id, bucket_id, date, amount_cents, memo, origin_type, origin_id, created_at
      FROM bucket_movements
      WHERE id = ?
    `).get(movementId);

    res.status(201).json({ data: movement });
  } catch (e: any) {
    console.error('[buckets] POST movements error:', e);
    res.status(500).json({ error: e?.message || 'Failed to create movement' });
  }
});

// DELETE /api/buckets/:id
bucketsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb(req);

    const result = db.prepare('DELETE FROM buckets WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error('[buckets] DELETE error:', e);
    res.status(500).json({ error: e?.message || 'Failed to delete bucket' });
  }
});

