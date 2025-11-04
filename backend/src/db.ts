import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { inferCategory } from './categorize';
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

export type CanonicalRow = {
  bookingDate?: string
  valueDate?: string
  amountCents?: number
  currency?: string
  purpose?: string
  counterpartName?: string
  accountIban?: string
  rawCode?: string
  category?: string
  categoryConfidence?: number
}

const ENV_DB = (process.env.NIMBUS_DB_PATH || '').trim()
const DEFAULT_DIR = path.resolve(__dirname, '..', 'data')
const DEFAULT_FILE = 'nimbus.sqlite'
const RESOLVED_PATH = ENV_DB ? path.resolve(ENV_DB) : path.resolve(DEFAULT_DIR, DEFAULT_FILE)

const dirForDb = path.dirname(RESOLVED_PATH)
if (!fs.existsSync(dirForDb)) fs.mkdirSync(dirForDb, { recursive: true })

type Database = BetterSqliteDatabase;

export function openDb(): Database {
  // Allow explicit override for tests/tools
  if (process.env.TEST_DB === '1' || process.env.NODE_ENV === 'test') {
    const mem = new BetterSqlite3(':memory:')
    mem.pragma('journal_mode = WAL')
    return mem
  }
  return new BetterSqlite3(RESOLVED_PATH)
}

export function ensureSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookingDate TEXT NOT NULL,
      valueDate   TEXT NOT NULL,
      amountCents INTEGER NOT NULL,
      currency    TEXT NOT NULL,
      purpose     TEXT NOT NULL,
      counterpartName TEXT,
      accountIban TEXT,
      rawCode     TEXT
      -- createdAt handled below
    );
  `);

  let columns = db.prepare(`PRAGMA table_info('transactions')`).all() as { name: string }[];

  const ensureColumn = (name: string, sql: string, postHook?: () => void) => {
    const exists = columns.some(c => c.name === name);
    if (!exists) {
      try {
        db.exec(sql);
        if (postHook) postHook();
      } catch (err) {
        console.warn('[migrate] column ensure failed:', name, (err as Error)?.message || err);
      }
      columns = db.prepare(`PRAGMA table_info('transactions')`).all() as { name: string }[];
    }
  };

  ensureColumn(
    'createdAt',
    "ALTER TABLE transactions ADD COLUMN createdAt TEXT DEFAULT (CURRENT_TIMESTAMP)",
    () => {
      db.exec(`UPDATE transactions SET createdAt = COALESCE(createdAt, CURRENT_TIMESTAMP);`);
    }
  );

  ensureColumn('category', "ALTER TABLE transactions ADD COLUMN category TEXT");
  ensureColumn('categoryConfidence', "ALTER TABLE transactions ADD COLUMN categoryConfidence REAL");
  ensureColumn('fingerprint', "ALTER TABLE transactions ADD COLUMN fingerprint TEXT");

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_tx_dedup
    ON transactions (bookingDate, valueDate, amountCents, purpose);
  `);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_tx_fingerprint ON transactions(fingerprint);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_bookingDate ON transactions(bookingDate DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_createdAt  ON transactions(createdAt  DESC);`);

  const idx = db.prepare(`PRAGMA index_list('transactions')`).all().map((i: any) => i.name);
  console.log('[migrate] schema ensured (transactions + ux_tx_dedup)');
  console.log('[migrate] indexes:', idx);
}

export function initDb(conn: Database): void {
  ensureSchema(conn);

  // Create achievements tables (not part of transactions schema)
  conn.exec(`
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tier TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  achievementCode TEXT NOT NULL,
  unlockedAt DATETIME,
  progress INTEGER NOT NULL DEFAULT 0,
  UNIQUE(achievementCode)
);
`);

  // Seed baseline achievements
  const baseline = [
    { code: 'FIRST_IMPORT', title: 'Erste CSV importiert', description: 'Du hast deine erste CSV importiert.', tier: 'bronze' },
    { code: 'SEVEN_DAY_STREAK', title: '7 Tage in Folge', description: '7 Tage in Folge Transaktionen.', tier: 'silver' },
    { code: 'MONTHLY_SAVER_500', title: 'Sparer 500 €+', description: '500 €+ Ersparnis in einem Monat.', tier: 'silver' },
    { code: 'CATEGORY_MASTER_GROCERIES', title: 'Lebensmittel < 200 €', description: 'Lebensmittel unter 200 € in einem Monat.', tier: 'bronze' },
    { code: 'ZERO_FEES_MONTH', title: 'Keine Gebühren', description: 'Keine Gebühren diesen Monat.', tier: 'gold' },
  ];
  const achUp = conn.prepare(`INSERT OR IGNORE INTO achievements (id, code, title, description, tier) VALUES (?, ?, ?, ?, ?)`);
  for (const a of baseline) {
    achUp.run(`ach_${a.code}`, a.code, a.title, a.description, a.tier);
  }
}

export function prepareDb(conn: Database): void {
  conn.pragma('journal_mode = WAL');
  initDb(conn);
}

let persistentDb = openDb()
prepareDb(persistentDb)
export let db: Database = persistentDb

export function replaceDb(newDb: Database): void {
  persistentDb = newDb
  db = newDb
}

export function txFingerprint(r: {
  bookingDate?: string
  valueDate?: string
  amountCents?: number
  currency?: string
  purpose?: string
  counterpartName?: string
  accountIban?: string
}) {
  const norm = (s?: string) => (s ?? '').trim().replace(/\s+/g,' ').toLowerCase()
  const parts = [
    r.bookingDate ?? '',
    r.valueDate ?? '',
    String(r.amountCents ?? 0),
    (r.currency ?? 'EUR').toUpperCase(),
    norm(r.purpose),
    norm(r.counterpartName),
    (r.accountIban ?? '').replace(/\s+/g,'').toUpperCase(),
  ]
  const data = parts.join('|')
  return crypto.createHash('sha256').update(data).digest('hex')
}

export function insertTransactions(rows: CanonicalRow[], conn: Database = db) {
  let inserted = 0, duplicates = 0
  const insertStmt = conn.prepare(`
    INSERT OR IGNORE INTO transactions
    (bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode, category, categoryConfidence)
    VALUES (@bookingDate, @valueDate, @amountCents, COALESCE(@currency,'EUR'), COALESCE(@purpose,''), @counterpartName, @accountIban, @rawCode, @category, @categoryConfidence)
  `)
  const tx = conn.transaction((batch: CanonicalRow[]) => {
    for (const r of batch) {
      const rec: any = {
        bookingDate: r.bookingDate,
        valueDate: r.valueDate ?? r.bookingDate,
        amountCents: r.amountCents ?? 0,
        currency: r.currency ?? 'EUR',
        purpose: (r.purpose ?? '').toString(),
        counterpartName: r.counterpartName ?? null,
        accountIban: r.accountIban ?? null,
        rawCode: r.rawCode ?? null,
        category: (r as any).category ?? null,
        categoryConfidence: (r as any).categoryConfidence ?? null,
      }
      if (!rec.category) {
        rec.category = inferCategory({
          purpose: rec.purpose,
          counterpartName: rec.counterpartName ?? undefined,
          rawCode: rec.rawCode ?? undefined,
        });
      }
      const info = insertStmt.run(rec)
      if ((info as any).changes === 1) inserted++
      else duplicates++
    }
  })
  try { console.log('[insert] starting tx, rows=' + rows.length) } catch {}
  tx(rows)
  try { console.log('[insert] inserted=' + inserted + ' duplicates=' + duplicates) } catch {}
  return { inserted, duplicates }
}

export function getRecentTransactions(limit = 10, conn: Database = db) {
  return conn.prepare(`
    SELECT id, bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode
    FROM transactions
    ORDER BY date(bookingDate) DESC, id DESC
    LIMIT ?
  `).all(limit)
}

export function getBalance(conn: Database = db) {
  const row = conn.prepare(`
    SELECT COALESCE(SUM(amountCents), 0) AS balanceCents
    FROM transactions
  `).get()
  return row as { balanceCents: number }
}

export function clearAll(conn: Database = db) {
  conn.exec(`DELETE FROM transactions`)
}

export function resetDb(conn: Database = db) {
  try {
    conn.prepare('DELETE FROM transactions').run();
    try { conn.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run('transactions'); } catch {}
  } catch {}
}

export const dbPath = (process.env.TEST_DB === '1' || process.env.NODE_ENV === 'test') ? ':memory:' : RESOLVED_PATH


