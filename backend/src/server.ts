import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
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

// Parser interfaces for DI
export type CanonicalRow = {
  bookingDate: string;
  valueDate?: string | null;
  amountCents: number;
  currency?: string;
  purpose?: string;
  counterpartName?: string;
  accountIban?: string;
  rawCode?: string;
};
export type ParseResult = { adapterId: string; rows: CanonicalRow[] };
export interface Parser { parseBufferAuto(buf: Buffer, opts?: any): Promise<ParseResult>; }

function parseEuroToCents(input: string): number {
  const s = String(input || '').trim().replace(/\s+/g,'').replace('€','');
  const neg = s.startsWith('-') || s.endsWith('-') || /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[()\-+]/g,'').replace(/\./g,'').replace(',', '.');
  const n = Math.round(parseFloat(cleaned) * 100);
  return (neg ? -1 : 1) * (Number.isFinite(n) ? n : 0);
}
function parseDeDate(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return undefined;
}

function makeDefaultParser(): Parser {
  try {
    // Try CJS require of installed parser; if ESM-only, this may throw.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const real = require('@nimbus/parser-de');
    if (real?.parseBufferAuto) {
      return {
        async parseBufferAuto(buf: Buffer, opts?: any) {
          const r = real.parseBufferAuto(buf, opts);
          // real parser may be sync; normalize
          const out = await Promise.resolve(r);
          return { adapterId: out.adapterId || 'parser', rows: out.rows } as ParseResult;
        },
      } as Parser;
    }
  } catch {}
  // Fallback minimal CSV parser
  return {
    async parseBufferAuto(buf: Buffer): Promise<ParseResult> {
      const text = buf.toString('utf8');
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) throw new Error('no rows');
      const delim = (lines[0].includes(';') ? ';' : ',');
      const headers = lines[0].split(delim).map(h => h.trim());
      const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
      const H = {
        buchung: idx('Buchungstag') >= 0 ? idx('Buchungstag') : idx('Buchung'),
        valuta: idx('Wertstellung'),
        betrag: idx('Betrag') >= 0 ? idx('Betrag') : idx('Betrag (EUR)'),
        waehr: idx('Währung'),
        zweck: idx('Verwendungszweck') >= 0 ? idx('Verwendungszweck') : idx('Buchungstext'),
        payee: idx('Begünstigter/Zahlungspflichtiger') >= 0 ? idx('Begünstigter/Zahlungspflichtiger') : idx('Auftraggeber/Empfänger'),
        iban: idx('IBAN'),
        code: idx('Umsatzart') >= 0 ? idx('Umsatzart') : idx('Kategorie'),
      };
      const rows: CanonicalRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delim);
        const bookingDate = parseDeDate(cols[H.buchung] || '') || '';
        const valueDate = parseDeDate(cols[H.valuta] || '') || undefined;
        const amountCents = parseEuroToCents(cols[H.betrag] || '0');
        const currency = (H.waehr >= 0 ? cols[H.waehr] : 'EUR') || 'EUR';
        const purpose = (H.zweck >= 0 ? cols[H.zweck] : '') || '';
        const counterpartName = (H.payee >= 0 ? cols[H.payee] : '') || '';
        const accountIban = (H.iban >= 0 ? String(cols[H.iban] || '').replace(/\s+/g,'') : '') || '';
        const rawCode = (H.code >= 0 ? cols[H.code] : '') || '';
        if (bookingDate) rows.push({ bookingDate, valueDate: valueDate ?? null, amountCents, currency, purpose, counterpartName, accountIban, rawCode });
      }
      return { adapterId: 'mock.csv', rows };
    }
  } as Parser;
}

export function createApp(deps?: { parser?: Parser }) {
  const app = express();
  const parser: Parser = deps?.parser ?? makeDefaultParser();

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
  try {
    const version = '0.1.0';
    const { db } = require('./db');
    let tables: string[] = [];
    let txCount = 0;
    try {
      tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]).map(r => r.name);
      const r = db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number };
      txCount = r?.c ?? 0;
    } catch {}
    res.json({ ok: true, version, db: { ok: true, tables, counts: { tx: txCount } } });
  } catch (e: any) {
    res.json({ ok: false, version: '0.1.0', message: e?.message || 'unhealthy', db: { ok: false, tables: [], counts: { tx: 0 } } });
  }
  });

// Diag
  app.get('/api/diag/adapters', async (_req, res) => {
    res.json({ adapters: [] });
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
        parsed = await parser.parseBufferAuto(buffer, { accountId: 'test' });
      } catch (e: any) {
        return res.status(422).json({ error: 'parse_failed', message: String(e?.message ?? e) });
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
        const payload = { adapterId: parsed.adapterId, imported: inserted, duplicates, total: (parsed.rows?.length ?? 0) };
        return res.json({ data: payload });
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
  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

export default createApp;


