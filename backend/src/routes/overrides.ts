import { Router } from 'express';
import { createOverrideRule } from '../services/overrides';
import type { CategoryId } from '../types/category';

export const overridesRouter = Router();

overridesRouter.post('/', (req, res) => {
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
