import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
// ESM-only parser; load on demand to work in CJS runtime
async function loadParser() {
  // Use native dynamic import even in CJS-compiled output
  // eslint-disable-next-line no-new-func
  const dynImport: (m: string) => Promise<any> = new Function('m', 'return import(m)') as any;
  try {
    // Prefer workspace source build if available to avoid stale node_modules copies
    const path = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const abs = path.resolve(process.cwd(), 'packages', 'parser-de', 'dist', 'index.js');
    const fileUrl = pathToFileURL(abs).href;
    // Attempt import of workspace dist
    return await dynImport(fileUrl);
  } catch {}
  return dynImport('@nimbus/parser-de');
}
import { insertTransactions, getBalance, getRecentTransactions, clearAll } from './db';
import summaryRouter from './routes/summary';
import { categorize } from './services/categorizer';

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 20);
const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const app = express();

// CORS
app.use(cors({
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return cb(null, true);
    if (CORS_ORIGIN.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET','POST','OPTIONS'],
  credentials: false,
}));
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Summary router
app.use('/api/summary', summaryRouter);
console.log('Mounted: /api/summary/*');

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Diag
app.get('/api/diag/adapters', async (_req, res) => {
  const { listAdapters } = await loadParser();
  res.json({ adapters: listAdapters() });
});

// Upload CSV
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

app.post('/api/imports/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 'NO_FILE', message: 'field "file" is required' });
    }
    const buffer = req.file.buffer;
    let parsed;
    try {
      const { parseBufferAuto } = await loadParser();
      parsed = parseBufferAuto(buffer);
    } catch (e: any) {
      if (e?.code === 'INVALID_DATE') return res.status(400).json({ code: 'INVALID_DATE', message: 'Invalid date format' });
      if (e?.code === 'INVALID_AMOUNT') return res.status(400).json({ code: 'INVALID_AMOUNT', message: 'Invalid amount format' });
      if (e?.code === 'NO_ROWS') return res.status(422).json({ code: 'NO_ROWS', message: 'File contains no rows' });
      throw e;
    }
    if ('needsMapping' in parsed) {
      return res.json({ needsMapping: true, headers: parsed.headers, sample: parsed.sample });
    }
    const canonical = (parsed.rows as any[]).map((r) => ({
      bookingDate: r.bookingDate ?? null,
      valueDate: r.valueDate ?? null,
      amountCents: r.amountCents ?? 0,
      currency: r.currency ?? 'EUR',
      purpose: r.purpose ?? null,
      counterpartName: r.counterpartName ?? null,
      accountIban: r.accountIban ?? null,
      rawCode: r.rawCode ?? null,
    })).map(r => {
      const cat = categorize(r.purpose || '', r.counterpartName || undefined);
      return { ...r, category: cat.category, categoryConfidence: cat.confidence };
    });
    try {
      const { inserted, duplicates } = insertTransactions(canonical as any);
      return res.json({ adapterId: parsed.adapterId, imported: inserted, duplicates, errors: [] });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'DB insert failed' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: (err as any)?.message || 'Unexpected error' });
  }
});

// Summary
app.get('/api/summary/balance', (_req, res) => {
  // total balance
  const total = getBalance();
  // income/expense MTD
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  // compute via SQL quickly
  // Using direct db here to avoid adding new API in db.ts
  const { db } = require('./db');
  const row = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END),0) AS income,
      COALESCE(SUM(CASE WHEN amountCents < 0 THEN -amountCents ELSE 0 END),0) AS expense
    FROM transactions
    WHERE bookingDate >= ? AND bookingDate <= ?
  `).get(from, to) as { income: number; expense: number };
  res.json({ balanceCents: total.balanceCents, incomeCentsMTD: row.income, expenseCentsMTD: row.expense });
});

// Monthly (current) income/expense
app.get('/api/summary/month', (_req, res) => {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const { db } = require('./db');
  const row = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END),0) AS incomeCents,
      COALESCE(SUM(CASE WHEN amountCents < 0 THEN -amountCents ELSE 0 END),0) AS expenseCents
    FROM transactions
    WHERE bookingDate >= ? AND bookingDate <= ?
  `).get(from, to) as { incomeCents: number; expenseCents: number };
  res.json(row);
});

// Transactions
app.get('/api/transactions', (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  const rows = getRecentTransactions(limit);
  res.json({ data: rows });
});

// Categories breakdown
app.get('/api/categories/breakdown', (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const where: string[] = [];
  const params: any[] = [];
  if (from) { where.push('bookingDate >= ?'); params.push(from); }
  if (to) { where.push('bookingDate <= ?'); params.push(to); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { db } = require('./db');
  const rows = db.prepare(`
    SELECT category as category, COUNT(*) as count, COALESCE(SUM(amountCents),0) as sumCents
    FROM transactions
    ${clause}
    GROUP BY category
  `).all(...params).map((r: any) => ({ category: r.category || 'other', count: Number(r.count), sumCents: Number(r.sumCents) }));
  const totalCents = rows.reduce((a: number, b: any) => a + b.sumCents, 0);
  res.json({ totalCents, entries: rows });
});

// Monthly summary
app.get('/api/summary/monthly', (req, res) => {
  const months = Math.max(1, Math.min(24, Number((req.query as any).months) || 6));
  const now = new Date();
  const buckets: { month: string; start: string; end: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    const start = `${month}-01`;
    const endDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0));
    const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth()+1).padStart(2,'0')}-${String(endDate.getUTCDate()).padStart(2,'0')}`;
    buckets.push({ month, start, end });
  }
  const { db } = require('./db');
  const out = buckets.map(b => {
    const r = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END),0) AS income,
        COALESCE(SUM(CASE WHEN amountCents < 0 THEN -amountCents ELSE 0 END),0) AS expense
      FROM transactions WHERE bookingDate >= ? AND bookingDate <= ?
    `).get(b.start, b.end) as { income: number; expense: number };
    return { month: b.month, incomeCents: r.income, expenseCents: r.expense };
  });
  res.json(out);
});

// Alias: monthly-6 shape with { series }
app.get('/api/summary/monthly-6', (_req, res) => {
  const months = 6;
  const now = new Date();
  const buckets: { month: string; start: string; end: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    const start = `${month}-01`;
    const endDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0));
    const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth()+1).padStart(2,'0')}-${String(endDate.getUTCDate()).padStart(2,'0')}`;
    buckets.push({ month, start, end });
  }
  const { db } = require('./db');
  const series = buckets.map(b => {
    const r = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END),0) AS incomeCents,
        COALESCE(SUM(CASE WHEN amountCents < 0 THEN -amountCents ELSE 0 END),0) AS expenseCents
      FROM transactions WHERE bookingDate >= ? AND bookingDate <= ?
    `).get(b.start, b.end) as { incomeCents: number; expenseCents: number };
    const label = b.month.slice(5);
    return { label, incomeCents: r.incomeCents, expenseCents: r.expenseCents };
  });
  res.json({ series });
});

// Dev reset
app.delete('/api/dev/reset', (_req, res) => {
  clearAll();
  res.json({ ok: true });
});

app.post('/api/dev/reset', (_req, res) => {
  clearAll();
  res.json({ ok: true });
});

// Optional demo seed for development
if (process.env.DEV_SEED === 'true') {
  try {
    const { db } = require('./db');
    const row = db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number };
    if ((row?.c ?? 0) === 0) {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const ins = db.prepare(`INSERT OR IGNORE INTO transactions (bookingDate, amountCents, currency, purpose, category, fingerprint) VALUES (?,?,?,?,?,?)`);
      const mk = (d: string, cents: number, purpose: string, cat?: string) => [d, cents, 'EUR', purpose, cat ?? null];
      const base: Array<[string, number, string, string | undefined]> = [
        [`${month}-01`, 300000, 'GEHALT ACME', 'income'],
        [`${month}-02`, -1567, 'REWE MARKT', 'groceries'],
        [`${month}-03`, -1299, 'NETFLIX', 'subscriptions'],
        [`${month}-04`, -45000, 'MIETE', 'housing'],
      ];
      for (const [d, c, p, cat] of base) {
        const sig = `${d}|${c}|${p}`;
        const fp = require('node:crypto').createHash('sha256').update(sig).digest('hex');
        ins.run(d, c, 'EUR', p, cat ?? null, fp);
      }
      console.log('DEV_SEED applied');
    }
  } catch {}
}

// 404
app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' }));

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

export default app;


