import type { Router, Request, Response } from 'express';
import { listCategories } from '../categorization/categoryRegistry';

export function mountCategoryRoutes(app: Router) {
  app.get('/api/categories', (req: Request, res: Response) => {
    try {
      const categories = listCategories();

      res.json({
        items: categories,
        count: categories.length,
      });
    } catch (err) {
      console.error('[categories] failed to list categories', err);
      res.status(500).json({
        code: 'CATEGORIES_FETCH_FAILED',
        message: 'Kategorien konnten nicht geladen werden.',
      });
    }
  });
}
