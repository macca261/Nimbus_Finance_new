import { Router } from 'express';
import type { Database } from '../db';
import { db as defaultDb } from '../db';
import { listImports, deleteImportById } from '../services/importsService';

function resolveDb(req: any): Database {
  return (req?.app?.locals?.db as Database) ?? defaultDb;
}

const importsRouter = Router();

importsRouter.get('/', (req, res) => {
  try {
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitParsed = Number.parseInt(typeof limitRaw === 'string' ? limitRaw : '', 10);
    const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(limitParsed, 100) : 50;
    const imports = listImports(limit, resolveDb(req));
    return res.json({ imports });
  } catch (err) {
    console.error('[imports] list error', err);
    return res.status(500).json({ error: 'Failed to load imports' });
  }
});

importsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid import id' });
  }
  try {
    const result = deleteImportById(id, resolveDb(req));
    if (!result.deleted) {
      return res.status(404).json({ error: 'Import not found' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error('[imports] delete error', err);
    return res.status(500).json({ error: 'Failed to delete import' });
  }
});

export default importsRouter;

