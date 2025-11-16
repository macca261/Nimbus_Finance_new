import { Router } from 'express';
import type { Database } from '../db';
import { db as defaultDb } from '../db';
import { deleteImportsByIds, listImports } from '../services/imports';

function resolveDb(req: any): Database {
  return (req?.app?.locals?.db as Database) ?? defaultDb;
}

export const adminImportsRouter = Router();

adminImportsRouter.get('/', (req, res) => {
  const conn = resolveDb(req);
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limitParsed = Number.parseInt(typeof limitRaw === 'string' ? limitRaw : '', 10);
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(limitParsed, 100) : 50;

  const imports = listImports(limit, conn).map(item => ({
    id: item.id,
    createdAt: item.createdAt,
    source: item.source,
    rowCount: item.rowCount,
    insertedCount: item.insertedCount,
    profileId: item.profileId,
    fileName: item.fileName,
    confidence: item.confidence,
    warnings: item.warnings,
    batchId: item.batchId,
  }));

  return res.json({ imports });
});

adminImportsRouter.delete('/', (req, res) => {
  const conn = resolveDb(req);
  const body = req.body as { ids?: Array<number | string> } | undefined;
  const ids = Array.isArray(body?.ids) ? body.ids : null;

  if (!ids?.length) {
    return res.status(400).json({
      ok: false,
      code: 'BAD_REQUEST',
      message: 'ids array required',
    });
  }

  try {
    const result = deleteImportsByIds(ids, conn);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Failed to delete imports', error);
    return res.status(500).json({
      ok: false,
      code: 'ADMIN_IMPORT_DELETE_FAILED',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default adminImportsRouter;


