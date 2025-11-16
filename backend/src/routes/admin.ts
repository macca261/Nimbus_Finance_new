import { Router } from 'express';
import { db, backfillInternalTransferCategories } from '../db';

const DEFAULT_TABLES = [
  'transactions',
  'user_overrides',
  'imports',
  'import_log',
  'transfer_links',
  'tx_category_feedback',
  'achievements',
  // extend with other domain tables when needed
];

export const adminRouter = Router();

adminRouter.post('/admin/reset', async (req, res) => {
  try {
    const conn = ((req.app as any)?.locals?.db ?? db);
    conn.exec('BEGIN');

    let totalDeleted = 0;
    for (const table of DEFAULT_TABLES) {
      try {
        const statement = conn.prepare(`DELETE FROM ${table}`);
        const result = statement.run();
        totalDeleted += result?.changes ?? 0;
      } catch {
        // ignore errors for tables that may not exist in the current schema
      }
    }

    conn.exec('COMMIT');

    return res.json({
      ok: true,
      deleted: totalDeleted,
      tablesProcessed: DEFAULT_TABLES.length,
    });
  } catch (error) {
    try {
      const conn = ((req.app as any)?.locals?.db ?? db);
      conn.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }

    return res.status(500).json({
      ok: false,
      code: 'ADMIN_RESET_FAILED',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export function mountAdminRoutes(router: Router): void {
  router.use('/api', adminRouter);

  // POST /api/admin/backfill/internal-transfers
  adminRouter.post('/admin/backfill/internal-transfers', (req, res) => {
    try {
      const conn = ((req.app as any)?.locals?.db ?? db);
      const updated = backfillInternalTransferCategories(conn);
      return res.json({ ok: true, updatedCount: updated });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || 'backfill failed' });
    }
  });
}


