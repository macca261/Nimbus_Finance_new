import { Router } from 'express';
import { breakdown } from '../db/sqlite';

const router = Router();

const BASE = [
  { id:'groceries', name:'Groceries' }, { id:'restaurants', name:'Restaurants' },
  { id:'transport', name:'Transport' }, { id:'utilities', name:'Utilities' },
  { id:'subscriptions', name:'Subscriptions' }, { id:'fees', name:'Fees' },
  { id:'salary', name:'Salary' }, { id:'rent', name:'Rent' },
  { id:'savings', name:'Savings' }, { id:'other', name:'Other' }
];

router.get('/', (_req, res) => res.json({ categories: BASE }));

router.get('/breakdown', (req, res) => {
  const { from = '1970-01-01', to = '2999-12-31' } = req.query as any;
  const map = breakdown(String(from), String(to));
  res.json({ breakdown: map });
});

export default router;


