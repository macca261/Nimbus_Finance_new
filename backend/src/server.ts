import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { db as defaultDb, insertTransactions, getBalance, clearAll, openDb, initDb, ensureSchema, prepareDb, replaceDb, dbPath } from './db';
import { insertManyTransactions, type InsertRow } from './insert';
import { evaluateAll } from './services/achievements';
import summaryRouter from './routes/summary';
import { categorize } from './categorization';
import achievementsRouter from './routes/achievements';
import { importRouter } from './routes/import';
import { paypalRouter } from './routes/paypal';
import { overridesRouter } from './routes/overrides';
import { transactionsRouter } from './routes/transactions';
import dashboardRouter from './routes/dashboard';
import devResetRouter from './routes/dev-reset';
import os from 'node:os';
import fs from 'node:fs';
import { decodeCsvBuffer } from './lib/text';
import { parseGermanCSV } from './parsers/generic_de';

function toCsvLine(values: (string | number | null | undefined)[]): string {
  const esc = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return values.map(v => esc(v == null ? '' : String(v))).join(',') + '\n';
}

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
export type ParseResult = { adapterId: string; rows: CanonicalRow[]; _debug?: any };
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

function toCents(input: unknown): number {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.round(input * 100);
  const s = String(input ?? '').replace(/[^\d,.-]/g, '').trim();
  if (!s) return NaN;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
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
          return { adapterId: out.adapterId || 'parser', rows: out.rows, _debug: (out as any)._debug } as any;
        },
      } as Parser;
    }
  } catch {}
  // Fallback minimal CSV parser
  return {
    async parseBufferAuto(buf: Buffer): Promise<ParseResult> {
      const decoded = decodeCsvBuffer(buf);
      const text = decoded.text;
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
      return { adapterId: 'mock.csv', rows, _debug: { encoding: decoded.encoding } as any };
    }
  } as Parser;
}

export function createApp(deps?: { db?: any; parser?: Parser }) {
  const app = express();
  const parser: Parser = deps?.parser ?? makeDefaultParser();
  const db = deps?.db ?? (process.env.NODE_ENV === 'test' ? openDb() : defaultDb);
  if (process.env.NODE_ENV === 'test' && !deps?.db) initDb(db);
  (app as any).locals.db = db;

  // Ensure schema is properly set up right after connecting
  ensureSchema(db);

  try { console.log('[db] using', dbPath); } catch {}
  try {
    console.log('[server] pid=', process.pid, 'cwd=', process.cwd(), 'dbPath=', dbPath);
    console.log('[server] env TEST_DB=', process.env.TEST_DB, 'NIMBUS_DB_PATH=', process.env.NIMBUS_DB_PATH);
  } catch {}

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
  app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '20mb' }));

  // Health endpoint (mount early)
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Summary router
  app.use('/api/summary', summaryRouter);
  app.use('/api/achievements', achievementsRouter);
  app.use('/api/import', importRouter);
  app.use('/api/paypal', paypalRouter);
  app.use('/api/overrides', overridesRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/dashboard', dashboardRouter);
  if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
    app.use('/api', devResetRouter);
    console.log('Mounted: /api/dev/reset (development)');
  }
  console.log('Mounted: /api/health');
  console.log('Mounted: /api/summary/*');
  console.log('Mounted: /api/achievements');
  console.log('Mounted: /api/import');
  console.log('Mounted: /api/transactions');
  console.log('Mounted: /api/dashboard');

  // Extended health endpoint (keep for compatibility)
  app.get('/api/health-extended', (req, res) => {
  try {
    const version = '0.1.0';
    const db = (req.app as any).locals.db;
    let tables: string[] = [];
    let txCount = 0;
    try {
      tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]).map(r => r.name);
      const r = db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number };
      txCount = r?.c ?? 0;
    } catch {}
    res.json({ ok: true, version, dbPath, db: { ok: true, tables, counts: { tx: txCount } } });
  } catch (e: any) {
    res.json({ ok: false, version: '0.1.0', message: e?.message || 'unhealthy', dbPath, db: { ok: false, tables: [], counts: { tx: 0 } } });
  }
  });

  // Deep diagnostics
  app.get('/api/debug/info', (_req, res) => {
    try {
      const tables = ((db as any).prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as { name: string }[]).map(r => r.name);
      const count = ((db as any).prepare('SELECT COUNT(*) AS c FROM transactions').get() as { c: number })?.c ?? 0;
      res.json({
        data: {
          pid: process.pid,
          cwd: process.cwd(),
          node: process.version,
          dbPath,
          fileExists: (() => { try { return require('node:fs').existsSync(dbPath); } catch { return false; } })(),
          tables,
          count,
          env: {
            NODE_ENV: process.env.NODE_ENV || null,
            TEST_DB: process.env.TEST_DB || null,
            NIMBUS_DB_PATH: process.env.NIMBUS_DB_PATH || null,
          },
          host: { platform: process.platform, arch: process.arch, user: (() => { try { return os.userInfo().username; } catch { return 'unknown'; } })() }
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'debug info failed' });
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
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Keine Datei empfangen.' });
      }
      try {
        console.log('[import] received file', {
          size: req.file.size,
          mimetype: req.file.mimetype,
          originalname: req.file.originalname,
        });
      } catch {}

      let parseResult;
      try {
        parseResult = parseGermanCSV(req.file.buffer);
      } catch (e: any) {
        console.error('[import] parse error:', e?.message || e);
        return res.status(422).json({
          error: 'CSV konnte nicht verarbeitet werden. Bitte prüfen Sie Trennzeichen (;) und Dezimalformat (z.B. 1.234,56).',
          reason: e?.message || 'Unbekannter Fehler',
        });
      }

      if (!parseResult.rows || !Array.isArray(parseResult.rows) || parseResult.rows.length === 0) {
        return res.status(422).json({
          error: 'CSV konnte nicht verarbeitet werden.',
          reason: 'Keine Zeilen gefunden.',
          _debug: parseResult._debug,
        });
      }

      // Map parser rows to InsertRow format
      const db = (req.app as any).locals.db;
      const mappedRows: InsertRow[] = parseResult.rows.map(r => {
        const normalized: InsertRow = {
          bookingDate: r.bookingDate,
          valueDate: r.valueDate ?? r.bookingDate,
          amountCents: r.amountCents,
          currency: r.currency ?? 'EUR',
          purpose: r.purpose || '',
          direction: r.amountCents >= 0 ? 'in' : 'out',
          counterpartName: r.counterpartName ?? null,
          accountIban: r.accountIban ?? null,
          rawCode: r.rawCode ?? null,
          raw: r as unknown as Record<string, unknown>,
          importFile: req.file?.originalname ?? 'upload.csv',
          category: null,
        };
        const textParts = [
          normalized.purpose,
          normalized.counterpartName ?? undefined,
          normalized.accountIban ?? undefined,
        ].filter((value): value is string => Boolean(value && value.toString().trim()));
        const categoryResult = categorize({
          text: textParts.join(' '),
          amount: normalized.amountCents / 100,
          amountCents: normalized.amountCents,
          iban: normalized.accountIban ?? null,
          counterpart: normalized.counterpartName ?? null,
          memo: normalized.purpose,
          payee: normalized.counterpartName ?? null,
          source: 'csv_bank',
        });
        normalized.category = categoryResult.category;
        normalized.categorySource = categoryResult.source;
        normalized.categoryConfidence = categoryResult.confidence;
        normalized.categoryExplanation = categoryResult.explanation ?? null;
        normalized.categoryRuleId = categoryResult.ruleId ?? null;
        if (categoryResult.confidence < 0.5) {
          try {
            console.debug?.('categorize:low', {
              category: categoryResult.category,
              confidence: categoryResult.confidence,
              explanation: categoryResult.explanation,
            });
          } catch {}
        }
        return normalized;
      });

      const { inserted, duplicates } = insertManyTransactions(db, mappedRows);
      console.log('[import] result inserted=', inserted, 'duplicates=', duplicates, 'adapterId=', parseResult.adapterId);

      try { await evaluateAll(); } catch {}

      return res.json({
        data: {
          adapterId: parseResult.adapterId,
          imported: inserted,
          duplicates,
          _debug: parseResult._debug,
        },
      });
    } catch (err: any) {
      console.error('[import] unexpected error:', err?.message || err);
      return res.status(422).json({
        error: 'Import fehlgeschlagen.',
        reason: err?.message || 'Unbekannter Fehler',
      });
    }
  });

// Summary
  app.get('/api/summary/balance', (req, res) => {
  // total balance
  const total = getBalance((req.app as any).locals.db);
  // income/expense MTD
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  // compute via SQL quickly
  // Using direct db here to avoid adding new API in db.ts
  const db = (req.app as any).locals.db;
  const row = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END),0) AS income,
      COALESCE(SUM(CASE WHEN amountCents < 0 THEN -amountCents ELSE 0 END),0) AS expense
    FROM transactions
    WHERE bookingDate >= ? AND bookingDate <= ?
  `).get(from, to) as { income: number; expense: number };
    res.json({ data: { balanceCents: total.balanceCents, currency: 'EUR' } });
  });

// Monthly (current) income/expense
app.get('/api/summary/month', (req, res) => {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const db = (req.app as any).locals.db;
  const row = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END),0) AS incomeCents,
      COALESCE(SUM(CASE WHEN amountCents < 0 THEN -amountCents ELSE 0 END),0) AS expenseCents
    FROM transactions
    WHERE bookingDate >= ? AND bookingDate <= ?
  `).get(from, to) as { incomeCents: number; expenseCents: number };
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  res.json({ month: ym, incomeCents: row.incomeCents, expenseCents: row.expenseCents });
});

  app.get('/api/transactions.csv', (req, res) => {
    const rawLimit = Number.parseInt(String(req.query.limit ?? '1000'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(5000, rawLimit)) : 1000;
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;

    const filters: string[] = [];
    const params: unknown[] = [];
    if (dateFrom) {
      filters.push('bookingDate >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      filters.push('bookingDate <= ?');
      params.push(dateTo);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    params.push(limit);

    const rows = ((req.app as any).locals.db as import('better-sqlite3').Database)
      .prepare(`
        SELECT id, bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode, createdAt
        FROM transactions
        ${whereClause}
        ORDER BY date(bookingDate) DESC, id DESC
        LIMIT ?
      `)
      .all(...params) as {
        id: number;
        bookingDate: string | null;
        valueDate: string | null;
        amountCents: number | null;
        currency: string | null;
        purpose: string | null;
        counterpartName: string | null;
        accountIban: string | null;
        rawCode: string | null;
        createdAt: string | null;
      }[];

    const header = ['id','bookingDate','valueDate','amountCents','currency','purpose','counterpartName','accountIban','rawCode','createdAt'];
    let csv = toCsvLine(header);
    for (const row of rows) {
      csv += toCsvLine([
        row.id,
        row.bookingDate,
        row.valueDate,
        row.amountCents,
        row.currency,
        row.purpose,
        row.counterpartName,
        row.accountIban,
        row.rawCode,
        row.createdAt,
      ]);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(csv);
  });

// Categories breakdown
app.get('/api/categories/breakdown', (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const where: string[] = [];
  const params: any[] = [];
  if (from) { where.push('bookingDate >= ?'); params.push(from); }
  if (to) { where.push('bookingDate <= ?'); params.push(to); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const db = (req.app as any).locals.db;
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
  const db = (req.app as any).locals.db;
  const out = buckets.map(b => {
    const r = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN amountCents > 0 THEN amountCents ELSE 0 END),0) AS income,
        COALESCE(SUM(CASE WHEN amountCents < 0 THEN -amountCents ELSE 0 END),0) AS expense
      FROM transactions WHERE bookingDate >= ? AND bookingDate <= ?
    `).get(b.start, b.end) as { income: number; expense: number };
    return { month: b.month, incomeCents: r.income, expenseCents: r.expense };
  });
  res.json({ data: out });
});

// Alias: monthly-6 shape with { series }
app.get('/api/summary/monthly-6', (req, res) => {
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
  const db = (req.app as any).locals.db;
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
  const baseMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  res.json({ baseMonth, series });
});

// Dev reset
  app.delete('/api/dev/reset', (req, res) => {
  clearAll((req.app as any).locals.db);
  res.json({ ok: true });
  });

  app.post('/api/dev/reset', (req, res) => {
  clearAll((req.app as any).locals.db);
  res.json({ ok: true });
  });

  // Debug: reset (DEV only)
  app.post('/api/debug/reset', (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'forbidden' });
    try {
      const current = (req.app as any).locals.db as import('better-sqlite3').Database;
      const currentPath = current?.name as string | undefined;
      try { current.close(); } catch {}
      if (currentPath && currentPath !== ':memory:') {
        try { fs.unlinkSync(currentPath); } catch {}
      }
      const fresh = openDb();
      prepareDb(fresh);
      replaceDb(fresh);
      (req.app as any).locals.db = fresh;
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'reset failed' });
    }
  });

  app.post('/api/dev/eval', async (_req, res) => {
    try { await evaluateAll(); } catch {}
    res.json({ ok: true });
  });

// Debug: last rows
  app.get('/api/debug/rows', (req, res) => {
    try {
      const db = (req.app as any).locals.db;
      const limit = Math.max(1, Math.min(200, Number((req.query as any)?.limit) || 5));
      const rows = db.prepare(`
        SELECT id, bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode, category, createdAt
        FROM transactions
        ORDER BY COALESCE(createdAt, bookingDate) DESC, id DESC
        LIMIT ?
      `).all(limit) as any[];
      const count = (db.prepare(`SELECT COUNT(1) AS c FROM transactions`).get() as { c: number })?.c ?? 0;
      res.json({ data: { rows, count, dbPath } });
    } catch {
      res.json({ data: { rows: [], count: 0, dbPath } });
    }
  });

// Debug: seed rows (3 known rows)
  app.post('/api/debug/seed', (req, res) => {
    try {
      const db = (req.app as any).locals.db;
      const sample = [
        { bookingDate: '2025-03-01', valueDate: '2025-03-01', amountCents: 300000, currency: 'EUR', purpose: 'GEHALT ACME GMBH' },
        { bookingDate: '2025-03-02', valueDate: '2025-03-02', amountCents: -3124,  currency: 'EUR', purpose: 'REWE MARKT 123 BERLIN' },
        { bookingDate: '2025-03-03', valueDate: '2025-03-03', amountCents: -990,   currency: 'EUR', purpose: 'KARTENENTGELT MÄRZ' },
      ];
      const { inserted, duplicates } = insertManyTransactions(db, sample);
      res.json({ data: { inserted, duplicates } });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Seed fehlgeschlagen' });
    }
  });

// Debug stats
  app.get('/api/debug/stats', (req, res) => {
    try {
      const db = (req.app as any).locals.db;
      const row = db.prepare(`SELECT COUNT(1) AS count, MIN(bookingDate) AS minDate, MAX(bookingDate) AS maxDate FROM transactions`).get() as { count: number; minDate?: string; maxDate?: string };
      res.json({ data: { count: row.count || 0, minDate: row.minDate || null, maxDate: row.maxDate || null, dbPath } });
    } catch {
      res.json({ data: { count: 0, minDate: null, maxDate: null, dbPath } });
    }
  });

  // Debug: schema
  app.get('/api/debug/schema', (req, res) => {
    try {
      const db = (req.app as any).locals.db;
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as { name: string }[];
      const indexList = db.prepare(`PRAGMA index_list(transactions)`).all() as { name: string; unique: number }[];
      const indexes = indexList.map(ix => ix.name);
      res.json({ data: { tables: tables.map(t => t.name), indexes } });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'schema error' });
    }
  });

  function fallbackParseGermanCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return [] as any[];
    const header = lines[0].split(';').map(s => s.trim().toLowerCase());
    const find = (re: RegExp) => header.findIndex(h => re.test(h));
    const idx = {
      booking: find(/buchung|buchungstag|buchungsdatum|date|datum/),
      value:   find(/wert|valuta|valuedatum|valuedate/),
      amount:  find(/betrag|amount|umsatz/),
      purpose: find(/verwendungszweck|buchungstext|text|zweck|beschreibung/),
      currency: find(/w[aä]hrung|currency/),
    } as const;
    const out: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(';').map(s => s.trim());
      if (parts.length < 2) continue;
      const booking = (idx.booking >= 0 ? parts[idx.booking] : parts[0]) || '';
      const value   = idx.value >= 0 ? parts[idx.value] : booking;
      const cur     = idx.currency >= 0 ? parts[idx.currency] : 'EUR';
      const purpose = idx.purpose >= 0 ? parts[idx.purpose] : '';
      const amtRaw  = idx.amount >= 0 ? parts[idx.amount] : '0';
      const amtNorm = amtRaw.replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
      const amountCents = Math.round(parseFloat(amtNorm || '0') * 100);
      const norm = (s: string) => {
        const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        if (m) {
          const dd = m[1].padStart(2, '0');
          const mm = m[2].padStart(2, '0');
          const yyyy = m[3].length === 2 ? '20' + m[3] : m[3];
          return `${yyyy}-${mm}-${dd}`;
        }
        return s;
      };
      out.push({ bookingDate: norm(booking), valueDate: norm(value), amountCents, currency: cur || 'EUR', purpose });
    }
    try { console.log('[fallback] parsed rows:', out.length); } catch {}
    return out.filter(r => Number.isFinite(r.amountCents) && /^\d{4}-\d{2}-\d{2}$/.test(String(r.bookingDate || '')));
  }

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

  // AI Ask endpoint (stub)
  app.post('/api/ai/ask', (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'query required' });
      }
      // Stub response for now
      const responses = [
        `Based on your query "${query}", I can help you analyze your finances. This is a stub response.`,
        `I understand you're asking about "${query}". Once the AI integration is complete, I'll provide detailed insights.`,
        `Your question about "${query}" is noted. AI features are coming soon!`,
      ];
      const response = responses[Math.floor(Math.random() * responses.length)];
      res.json({ response });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'AI service error' });
    }
  });

  // 404
  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' }));
  return app;
}

export const app = createApp();

if (require.main === module) {
  // Port fallback: try PORT, then find next available port
  function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
    return new Promise((resolve, reject) => {
      const net = require('net');
      let port = startPort;
      let attempts = 0;
      
      function tryPort() {
        if (attempts >= maxAttempts) {
          reject(new Error(`Could not find available port after ${maxAttempts} attempts`));
          return;
        }
        
        const server = net.createServer();
        
        server.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            attempts++;
            port++;
            tryPort();
          } else {
            reject(err);
          }
        });
        
        server.listen(port, () => {
          server.close(() => {
            resolve(port);
          });
        });
      }
      
      tryPort();
    });
  }
  
  // Start server with port fallback
  (async () => {
    try {
      const targetPort = await findAvailablePort(PORT);
      app.listen(targetPort, () => {
        console.log(`API listening on http://localhost:${targetPort}`);
      });
    } catch (err: any) {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    }
  })();
}

export default app;