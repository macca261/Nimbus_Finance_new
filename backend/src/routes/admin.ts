import { Router } from 'express';
import { db } from '../db';
import { deleteImportsByIds, listImports } from '../services/imports';

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

adminRouter.get('/admin/imports', (req, res) => {
  const conn = ((req.app as any)?.locals?.db ?? db);
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limitParsed = Number.parseInt(typeof limitRaw === 'string' ? limitRaw : '', 10);
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(limitParsed, 100) : 50;
  const imports = listImports(limit, conn);
  return res.json({ imports });
});

adminRouter.delete('/admin/imports', (req, res) => {
  const conn = ((req.app as any)?.locals?.db ?? db);
  const body = req.body as { ids?: Array<number | string> } | undefined;
  const ids = Array.isArray(body?.ids) ? body?.ids : null;
  if (!ids?.length) {
    return res.status(400).json({
      ok: false,
      code: 'BAD_REQUEST',
      message: 'ids array required',
    });
  }

  try {
    const result = deleteImportsByIds(ids, conn);
    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to delete imports', error);
    return res.status(500).json({
      ok: false,
      code: 'ADMIN_IMPORT_DELETE_FAILED',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export function mountAdminRoutes(router: Router): void {
  router.use('/api', adminRouter);
}


