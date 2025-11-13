import { Router } from 'express';
import { createOverrideRule } from '../services/overrides';
import type { CategoryId } from '../types/category';
import { clearOverride, getOverride, setOverride } from '../categorization/overrides';

export const overridesRouter = Router();

overridesRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'id required' });
  }
  const override = await getOverride(String(id));
  return res.json({ ok: true, override });
});

overridesRouter.post('/', async (req, res) => {
  const { id, category } = req.body ?? {};
  if (!id || !category) {
    return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'id and category required' });
  }
  await setOverride(String(id), String(category));
  const override = await getOverride(String(id));
  return res.json({ ok: true, override });
});

overridesRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'id required' });
  }
  await clearOverride(String(id));
  return res.json({ ok: true });
});

overridesRouter.post('/rules', (req, res) => {
  try {
    const { txId, categoryId, scope, applyToPast } = req.body ?? {};
    if (!txId || typeof txId !== 'string') {
      return res.status(400).json({ error: 'txId is required' });
    }
    if (!categoryId || typeof categoryId !== 'string') {
      return res.status(400).json({ error: 'categoryId is required' });
    }

    const db = (req.app as any)?.locals?.db;
    const rule = createOverrideRule(
      {
        txId,
        categoryId: categoryId as CategoryId,
        scope,
        applyToPast,
      },
      db,
    );

    return res.status(201).json({ rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return res.status(400).json({ error: message });
  }
});
