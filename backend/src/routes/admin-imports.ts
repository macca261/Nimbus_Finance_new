import { Router } from 'express';
import type { Database } from '../db';
import { db as defaultDb } from '../db';
import { listImports, deleteImportById } from '../services/importsService';

function resolveDb(req: any): Database {
  return (req?.app?.locals?.db as Database) ?? defaultDb;
}

export const adminImportsRouter = Router();

adminImportsRouter.get('/', (req, res) => {
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limitParsed = Number.parseInt(typeof limitRaw === 'string' ? limitRaw : '', 10);
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(limitParsed, 100) : 50;
  const imports = listImports(limit, resolveDb(req)).map(item => ({
    id: item.id,
    createdAt: item.createdAt,
    source: item.filename,
    rowCount: item.rowCount,
    insertedCount: item.rowCount,
    profileId: 'csv',
    fileName: item.filename,
    confidence: 1,
    warnings: item.warnings,
    status: item.status,
  }));
  return res.json({ imports });
});

adminImportsRouter.delete('/', (req, res) => {
  const body = req.body as { ids?: Array<number | string> } | undefined;
  const ids = Array.isArray(body?.ids) ? body.ids : null;
  if (!ids?.length) {
    return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'ids array required' });
  }
  try {
    const conn = resolveDb(req);
    let deletedImports = 0;
    let deletedTransactions = 0;
    for (const rawId of ids) {
      const id = Number(rawId);
      if (!Number.isFinite(id)) continue;
      const result = deleteImportById(id, conn);
      if (result.deleted) {
        deletedImports += 1;
        deletedTransactions += result.deletedTransactions;
      }
    }
    return res.json({ ok: true, deletedImports, deletedTransactions });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      code: 'ADMIN_IMPORT_DELETE_FAILED',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default adminImportsRouter;


