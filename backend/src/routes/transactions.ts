import { Router } from 'express';
import { recentTransactions } from '../db/sqlite';

const router = Router();

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 20), 200);
  const rows = recentTransactions(limit);
  res.json({ rows });
});

export default router;


