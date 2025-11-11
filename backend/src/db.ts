import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { categorize } from './categorization';
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import type { Transaction, UserOverrideRule, Source, TransferLink } from './types/core';
import type { NormalizedTransaction } from './types/transactions';
import type { CategoryId } from './types/category';
import { findMatchingOverride } from './overrides/userOverrides';

export type CanonicalRow = {
  publicId?: string;
  bookingDate?: string
  valueDate?: string
  amountCents?: number
  currency?: string
  purpose?: string
  direction?: 'in' | 'out'
  counterpartName?: string
  counterpartyIban?: string
  accountIban?: string
  bankProfile?: string
  rawCode?: string
  raw?: Record<string, unknown>
  importFile?: string | null
  category?: string
  categoryConfidence?: number
  categorySource?: string
  categoryExplanation?: string
  categoryRuleId?: string | null
  source?: string | null
  sourceProfile?: string | null
  accountId?: string | null
  payee?: string | null
  memo?: string | null
  externalId?: string | null
  referenceId?: string | null
  isTransfer?: boolean
  transferLinkId?: string | null
  confidence?: number | null
}

const ENV_DB = (process.env.NIMBUS_DB_PATH || '').trim()
const DEFAULT_DIR = path.resolve(__dirname, '..', 'data')
const DEFAULT_FILE = 'nimbus.sqlite'
const RESOLVED_PATH = ENV_DB ? path.resolve(ENV_DB) : path.resolve(DEFAULT_DIR, DEFAULT_FILE)

const dirForDb = path.dirname(RESOLVED_PATH)
if (!fs.existsSync(dirForDb)) fs.mkdirSync(dirForDb, { recursive: true })

export type Database = BetterSqliteDatabase;

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
  ensureColumn('category_source', "ALTER TABLE transactions ADD COLUMN category_source TEXT");
  ensureColumn('category_confidence', "ALTER TABLE transactions ADD COLUMN category_confidence REAL");
  ensureColumn('category_explanation', "ALTER TABLE transactions ADD COLUMN category_explanation TEXT");
  ensureColumn('category_rule_id', "ALTER TABLE transactions ADD COLUMN category_rule_id TEXT");
  ensureColumn('raw', "ALTER TABLE transactions ADD COLUMN raw TEXT");
  ensureColumn('importFile', "ALTER TABLE transactions ADD COLUMN importFile TEXT");
  ensureColumn('fingerprint', "ALTER TABLE transactions ADD COLUMN fingerprint TEXT");
  ensureColumn('direction', "ALTER TABLE transactions ADD COLUMN direction TEXT");
  ensureColumn('counterpartyIban', "ALTER TABLE transactions ADD COLUMN counterpartyIban TEXT");
  ensureColumn('bankProfile', "ALTER TABLE transactions ADD COLUMN bankProfile TEXT");
  ensureColumn('publicId', "ALTER TABLE transactions ADD COLUMN publicId TEXT", () => {
    const rows = db.prepare(`SELECT id FROM transactions WHERE publicId IS NULL`).all() as { id: number }[];
    const update = db.prepare(`UPDATE transactions SET publicId = @publicId WHERE id = @id`);
    for (const row of rows) {
      update.run({ id: row.id, publicId: crypto.randomUUID() });
    }
  });
  ensureColumn('source', "ALTER TABLE transactions ADD COLUMN source TEXT");
  ensureColumn('sourceProfile', "ALTER TABLE transactions ADD COLUMN sourceProfile TEXT");
  ensureColumn('accountId', "ALTER TABLE transactions ADD COLUMN accountId TEXT");
  ensureColumn('payee', "ALTER TABLE transactions ADD COLUMN payee TEXT");
  ensureColumn('memo', "ALTER TABLE transactions ADD COLUMN memo TEXT");
  ensureColumn('externalId', "ALTER TABLE transactions ADD COLUMN externalId TEXT");
  ensureColumn('referenceId', "ALTER TABLE transactions ADD COLUMN referenceId TEXT");
  ensureColumn('isTransfer', "ALTER TABLE transactions ADD COLUMN isTransfer INTEGER DEFAULT 0");
  ensureColumn('transferLinkId', "ALTER TABLE transactions ADD COLUMN transferLinkId TEXT");
  ensureColumn('confidence', "ALTER TABLE transactions ADD COLUMN confidence REAL");

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_tx_dedup
    ON transactions (bookingDate, valueDate, amountCents, purpose);
  `);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_tx_fingerprint ON transactions(fingerprint);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_bookingDate ON transactions(bookingDate DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_createdAt  ON transactions(createdAt  DESC);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS transfer_links (
      id TEXT PRIMARY KEY,
      fromTxId TEXT NOT NULL,
      toTxId TEXT NOT NULL,
      kind TEXT NOT NULL,
      score REAL NOT NULL,
      reasons TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_transfer_links_pair ON transfer_links(fromTxId, toTxId);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_override_rules (
      id TEXT PRIMARY KEY,
      patternType TEXT NOT NULL,
      pattern TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      applyToPast INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_override_pattern ON user_override_rules(patternType, pattern);`);

  const idx = db.prepare(`PRAGMA index_list('transactions')`).all().map((i: any) => i.name);
  console.log('[migrate] schema ensured (transactions + ux_tx_dedup)');
  console.log('[migrate] indexes:', idx);

  db.exec(`
    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      confidence REAL NOT NULL,
      transactionCount INTEGER NOT NULL,
      warnings TEXT,
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tx_category_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txId INTEGER NOT NULL,
      oldCategory TEXT,
      newCategory TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (txId) REFERENCES transactions(id)
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_feedback_txId ON tx_category_feedback(txId);`);
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

export function getAllOverrideRules(conn: Database): UserOverrideRule[] {
  const rows = conn
    .prepare(`SELECT id, patternType, pattern, categoryId, applyToPast, createdAt FROM user_override_rules ORDER BY createdAt DESC`)
    .all();
  return rows.map((row: any) => ({
    id: row.id,
    patternType: row.patternType,
    pattern: row.pattern,
    categoryId: row.categoryId,
    applyToPast: Boolean(row.applyToPast),
    createdAt: row.createdAt,
  })) as UserOverrideRule[];
}

type NormalizedCanonicalRow = {
  publicId: string;
  bookingDate: string;
  valueDate: string;
  amountCents: number;
  currency: string;
  purpose: string;
  counterpartName?: string | null;
  counterpartyIban?: string | null;
  accountIban?: string | null;
  bankProfile?: string | null;
  rawCode?: string;
  raw?: Record<string, unknown>;
  importFile?: string | null;
  category?: string | null;
  categoryConfidence?: number | null;
  categorySource?: string | null;
  categoryExplanation?: string | null;
  categoryRuleId?: string | null;
  direction?: 'in' | 'out';
  fingerprint: string;
  source: Source;
  sourceProfile: string | null;
  accountId: string | null;
  payee?: string | null;
  memo?: string | null;
  externalId?: string | null;
  referenceId?: string | null;
  isTransfer?: boolean;
  transferLinkId?: string | null;
  confidence?: number | null;
  createdAt: string;
  transactionPayload: Transaction;
};

function normalizeCanonicalRow(row: CanonicalRow): NormalizedCanonicalRow {
  const bookingDate = row.bookingDate ?? new Date().toISOString().slice(0, 10);
  const valueDate = row.valueDate ?? bookingDate;
  const amountCents = row.amountCents ?? 0;
  const currency = (row.currency ?? 'EUR').toUpperCase();
  const purpose = row.purpose ?? '';
  const direction = row.direction ?? (amountCents >= 0 ? 'in' : 'out');
  const counterpartName = row.counterpartName ?? null;
  const counterpartyIban = row.counterpartyIban ?? null;
  const accountIban = row.accountIban ?? null;
  const bankProfile = row.bankProfile ?? null;
  const rawCode = row.rawCode ?? null;
  const raw = row.raw ?? {};
  const source: Source = (row.source as Source) ?? 'manual';
  const sourceProfile = row.sourceProfile ?? bankProfile ?? null;
  const accountId = row.accountId ?? accountIban ?? null;
  const payee = row.payee ?? counterpartName ?? null;
  const memo = row.memo ?? purpose;
  const externalId = row.externalId ?? null;
  const referenceId = row.referenceId ?? null;
  const isTransfer = Boolean(row.isTransfer);
  const transferLinkId = row.transferLinkId ?? null;
  const confidence = row.confidence ?? null;
  const createdAt = new Date().toISOString();

  const fingerprint = txFingerprint({
    bookingDate,
    valueDate,
    amountCents,
    currency,
    purpose,
    counterpartName: counterpartName ?? undefined,
    accountIban: accountIban ?? undefined,
  } as any);

  const publicId = row.publicId ?? rawCode ?? crypto.randomUUID();

  const transactionPayload: Transaction = {
    id: publicId,
    source,
    sourceProfile,
    accountId: accountId ?? 'unknown',
    bookingDate,
    valueDate,
    amountCents,
    currency,
    payee,
    counterparty: counterpartName,
    memo,
    categoryId: (row.category as any) ?? undefined,
    confidence: row.categoryConfidence ?? undefined,
    externalId,
    referenceId,
    isTransfer,
    transferLinkId,
    raw: { ...raw, accountIban, counterpartyIban },
  };

  return {
    publicId,
    bookingDate,
    valueDate,
    amountCents,
    currency,
    purpose,
    counterpartName,
    counterpartyIban,
    accountIban,
    bankProfile,
    rawCode: rawCode ?? undefined,
    raw,
    importFile: row.importFile ?? null,
    category: row.category ?? null,
    categoryConfidence: row.categoryConfidence ?? null,
    categorySource: row.categorySource ?? null,
    categoryExplanation: row.categoryExplanation ?? null,
    categoryRuleId: row.categoryRuleId ?? null,
    direction,
    fingerprint,
    source,
    sourceProfile,
    accountId,
    payee,
    memo,
    externalId,
    referenceId,
    isTransfer,
    transferLinkId,
    confidence,
    createdAt,
    transactionPayload,
  };
}

export function insertTransactions(rows: CanonicalRow[], conn: Database = db) {
  let inserted = 0, duplicates = 0;
  const insertStmt = conn.prepare(`
    INSERT OR IGNORE INTO transactions (
      publicId,
      bookingDate,
      valueDate,
      amountCents,
      currency,
      purpose,
      counterpartName,
      counterpartyIban,
      accountIban,
      rawCode,
      raw,
      importFile,
      category,
      categoryConfidence,
      category_source,
      category_explanation,
      category_rule_id,
      direction,
      bankProfile,
      fingerprint,
      createdAt,
      source,
      sourceProfile,
      accountId,
      payee,
      memo,
      externalId,
      referenceId,
      isTransfer,
      transferLinkId,
      confidence
    ) VALUES (
      @publicId,
      @bookingDate,
      @valueDate,
      @amountCents,
      @currency,
      @purpose,
      @counterpartName,
      @counterpartyIban,
      @accountIban,
      @rawCode,
      @raw,
      @importFile,
      @category,
      @categoryConfidence,
      @categorySource,
      @categoryExplanation,
      @categoryRuleId,
      @direction,
      @bankProfile,
      @fingerprint,
      @createdAt,
      @source,
      @sourceProfile,
      @accountId,
      @payee,
      @memo,
      @externalId,
      @referenceId,
      @isTransfer,
      @transferLinkId,
      @confidence
    )
  `);

  const tx = conn.transaction((batch: CanonicalRow[]) => {
    const overrideRules = getAllOverrideRules(conn);
    for (const r of batch) {
      const base = normalizeCanonicalRow(r);
      if (!base.category) {
        const overrideMatch = findMatchingOverride(base.transactionPayload, overrideRules);
        const result = categorize({
          text: base.transactionPayload.memo ?? base.transactionPayload.payee ?? base.purpose,
          amount: base.transactionPayload.amountCents / 100,
          amountCents: base.transactionPayload.amountCents,
          iban: base.transactionPayload.raw?.accountIban ? String(base.transactionPayload.raw.accountIban) : null,
          counterpart: base.transactionPayload.counterparty ?? null,
          memo: base.transactionPayload.memo,
          payee: base.transactionPayload.payee ?? null,
          source: base.transactionPayload.source,
          transaction: base.transactionPayload,
          overrideMatch: overrideMatch ? { ruleId: overrideMatch.rule.id, categoryId: overrideMatch.categoryId } : undefined,
        });
        base.category = result.category;
        base.categorySource = result.source;
        base.categoryConfidence = result.confidence;
        base.categoryExplanation = result.explanation ?? null;
        base.categoryRuleId = result.ruleId ?? null;
      }

      const info = insertStmt.run({
        publicId: base.publicId,
        bookingDate: base.bookingDate,
        valueDate: base.valueDate,
        amountCents: base.amountCents,
        currency: base.currency,
        purpose: base.purpose,
        counterpartName: base.counterpartName,
        counterpartyIban: base.counterpartyIban,
        accountIban: base.accountIban,
        rawCode: base.rawCode,
        raw: base.raw ? JSON.stringify(base.raw) : null,
        importFile: base.importFile,
        category: base.category,
        categoryConfidence: base.categoryConfidence,
        categorySource: base.categorySource,
        categoryExplanation: base.categoryExplanation,
        categoryRuleId: base.categoryRuleId,
        direction: base.direction,
        bankProfile: base.bankProfile,
        fingerprint: base.fingerprint,
        createdAt: base.createdAt,
        source: base.source,
        sourceProfile: base.sourceProfile,
        accountId: base.accountId,
        payee: base.payee,
        memo: base.memo,
        externalId: base.externalId,
        referenceId: base.referenceId,
        isTransfer: base.isTransfer ? 1 : 0,
        transferLinkId: base.transferLinkId,
        confidence: base.confidence,
      });

      if ((info as any).changes === 1) inserted++;
      else duplicates++;
    }
  });

  try { console.log('[insert] starting tx, rows=' + rows.length); } catch {}
  tx(rows);
  try { console.log('[insert] inserted=' + inserted + ' duplicates=' + duplicates); } catch {}
  return { inserted, duplicates };
}

export function getRecentTransactions(limit = 10, conn: Database = db) {
  return conn.prepare(`
    SELECT id, bookingDate, valueDate, amountCents, currency, purpose, counterpartName, accountIban, rawCode, category, category_source AS categorySource, category_confidence AS categoryConfidence, category_explanation AS categoryExplanation
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
    try { conn.prepare('DELETE FROM imports').run(); } catch {}
  } catch {}
}

export const dbPath = (process.env.TEST_DB === '1' || process.env.NODE_ENV === 'test') ? ':memory:' : RESOLVED_PATH

export interface ImportMeta {
  profileId: string;
  fileName: string;
  confidence: number;
  transactionCount: number;
  warnings: string[];
}

export function recordImport(meta: ImportMeta, conn: Database = db) {
  const stmt = conn.prepare(`
    INSERT INTO imports (profileId, fileName, confidence, transactionCount, warnings)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    meta.profileId,
    meta.fileName,
    meta.confidence,
    meta.transactionCount,
    JSON.stringify(meta.warnings ?? []),
  );
}

export function getLastImport(conn: Database = db) {
  const row = conn
    .prepare(
      `SELECT profileId, fileName, confidence, transactionCount, warnings, createdAt
       FROM imports
       ORDER BY datetime(createdAt) DESC
       LIMIT 1`,
    )
    .get() as
    | {
        profileId: string;
        fileName: string;
        confidence: number;
        transactionCount: number;
        warnings: string | null;
        createdAt: string;
      }
    | undefined;
  if (!row) return null;
  return {
    ...row,
    warnings: row.warnings ? (JSON.parse(row.warnings) as string[]) : [],
  };
}

export function getRecentImports(limit = 10, conn: Database = db) {
  const rows = conn
    .prepare(
      `SELECT profileId,
              fileName,
              confidence,
              transactionCount,
              warnings,
              createdAt
       FROM imports
       ORDER BY datetime(createdAt) DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    profileId: string;
    fileName: string;
    confidence: number;
    transactionCount: number;
    warnings: string | null;
    createdAt: string;
  }>;

  return rows.map(row => ({
    profileId: row.profileId,
    fileName: row.fileName,
    confidence: row.confidence,
    transactionCount: row.transactionCount,
    warnings: row.warnings ? (JSON.parse(row.warnings) as string[]) : [],
    createdAt: row.createdAt,
  }));
}

export function getTransactionById(id: number, conn: Database = db) {
  return conn
    .prepare(
      `SELECT id,
              bookingDate,
              valueDate,
              amountCents,
              currency,
              direction,
              counterpartName,
              purpose,
              accountIban,
              bankProfile,
              category,
              category_source AS categorySource,
              category_confidence AS categoryConfidence,
              category_explanation AS categoryExplanation,
              category_rule_id AS categoryRuleId
       FROM transactions
       WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number;
        bookingDate: string;
        valueDate: string;
        amountCents: number;
        currency: string;
        direction: 'in' | 'out' | null;
        counterpartName: string | null;
        purpose: string | null;
        accountIban: string | null;
        bankProfile: string | null;
        category: string | null;
        categorySource: string | null;
        categoryConfidence: number | null;
        categoryExplanation: string | null;
        categoryRuleId: string | null;
      }
    | undefined;
}

export function applyCategoryFeedback(input: { txId: number; newCategory: string }, conn: Database = db) {
  const existing = getTransactionById(input.txId, conn);
  if (!existing) {
    throw new Error(`Transaction ${input.txId} not found`);
  }

  const insert = conn.prepare(`
    INSERT INTO tx_category_feedback (txId, oldCategory, newCategory)
    VALUES (?, ?, ?)
  `);
  insert.run(input.txId, existing.category ?? null, input.newCategory);

  conn
    .prepare(
      `UPDATE transactions
       SET category = ?, category_source = 'feedback', category_confidence = 1, category_explanation = 'User override', category_rule_id = NULL
       WHERE id = ?`,
    )
    .run(input.newCategory, input.txId);

  return getTransactionById(input.txId, conn);
}

export function fetchTransactionsForMatching(conn: Database = db): { paypal: NormalizedTransaction[]; bank: NormalizedTransaction[] } {
  const paypalRows = conn
    .prepare(`SELECT publicId, source, sourceProfile, bankProfile, accountId, bookingDate, valueDate, amountCents, currency, payee, counterpartName, memo, category, categoryConfidence, externalId, referenceId, isTransfer, transferLinkId, raw FROM transactions WHERE source = @source AND (transferLinkId IS NULL OR transferLinkId = '')`)
    .all({ source: 'csv_paypal' });
  const bankRows = conn
    .prepare(`SELECT publicId, source, sourceProfile, bankProfile, accountId, bookingDate, valueDate, amountCents, currency, payee, counterpartName, memo, category, categoryConfidence, externalId, referenceId, isTransfer, transferLinkId, raw FROM transactions WHERE source = @source AND (transferLinkId IS NULL OR transferLinkId = '')`)
    .all({ source: 'csv_bank' });

  return {
    paypal: paypalRows.map(mapDbRowToNormalizedTransaction),
    bank: bankRows.map(mapDbRowToNormalizedTransaction),
  };
}

export function insertTransferLinkRecord(link: TransferLink, conn: Database = db): void {
  conn
    .prepare(`
      INSERT OR REPLACE INTO transfer_links (id, fromTxId, toTxId, kind, score, reasons)
      VALUES (@id, @fromTxId, @toTxId, @kind, @score, @reasons)
    `)
    .run({ ...link, reasons: JSON.stringify(link.reasons) });
}

export function markTransactionAsTransfer(params: { publicId: string; transferLinkId: string; categoryId: string; confidence?: number }, conn: Database = db): void {
  conn
    .prepare(`
      UPDATE transactions
      SET isTransfer = 1,
          transferLinkId = @transferLinkId,
          category = @category,
          category_source = 'rule',
          category_rule_id = 'transfer_matcher',
          category_confidence = COALESCE(@confidence, category_confidence, 0.95),
          categoryConfidence = COALESCE(@confidence, categoryConfidence, 0.95)
      WHERE publicId = @publicId
    `)
    .run({
      publicId: params.publicId,
      transferLinkId: params.transferLinkId,
      category: params.categoryId,
      confidence: params.confidence ?? 0.95,
    });
}

export function getTransactionByPublicId(publicId: string, conn: Database = db): Transaction | null {
  const row = conn
    .prepare(`SELECT publicId, source, sourceProfile, accountId, bookingDate, valueDate, amountCents, currency, payee, counterpartName, memo, category, categoryConfidence, externalId, referenceId, isTransfer, transferLinkId, raw FROM transactions WHERE publicId = @publicId LIMIT 1`)
    .get({ publicId });
  return row ? mapDbRowToCoreTransaction(row) : null;
}

export function insertOverrideRule(rule: Omit<UserOverrideRule, 'createdAt'>, conn: Database = db): UserOverrideRule {
  conn
    .prepare(`
      INSERT INTO user_override_rules (id, patternType, pattern, categoryId, applyToPast)
      VALUES (@id, @patternType, @pattern, @categoryId, @applyToPast)
    `)
    .run({
      id: rule.id,
      patternType: rule.patternType,
      pattern: rule.pattern.toLowerCase(),
      categoryId: rule.categoryId,
      applyToPast: rule.applyToPast ? 1 : 0,
    });
  return {
    ...rule,
    pattern: rule.pattern.toLowerCase(),
    createdAt: new Date().toISOString(),
  };
}

export function applyOverrideRuleToTransactions(rule: UserOverrideRule, conn: Database = db): void {
  const pattern = rule.pattern.toLowerCase();
  let sql = '';
  const params: any = { pattern, categoryId: rule.categoryId };
  switch (rule.patternType) {
    case 'payee':
      sql = `UPDATE transactions SET category = @categoryId, category_source = 'rule', category_rule_id = @ruleId WHERE LOWER(payee) LIKE '%' || @pattern || '%'`;
      break;
    case 'memo':
      sql = `UPDATE transactions SET category = @categoryId, category_source = 'rule', category_rule_id = @ruleId WHERE LOWER(memo) LIKE '%' || @pattern || '%'`;
      break;
    case 'iban':
      sql = `UPDATE transactions SET category = @categoryId, category_source = 'rule', category_rule_id = @ruleId WHERE REPLACE(LOWER(counterpartyIban), ' ', '') = @pattern`;
      break;
    case 'fingerprint':
      sql = `UPDATE transactions SET category = @categoryId, category_source = 'rule', category_rule_id = @ruleId WHERE publicId = @pattern`;
      break;
    default:
      return;
  }
  conn.prepare(sql).run({ ...params, ruleId: `user_override:${rule.id}` });
}

function mapDbRowToNormalizedTransaction(row: any): NormalizedTransaction {
  const rawObj = parseRaw(row.raw);
  const metadata = rawObj && rawObj.metadata && typeof rawObj.metadata === 'object' ? normalizeMetadata(rawObj.metadata as Record<string, unknown>) : undefined;
  if (rawObj?.metadata) delete rawObj.metadata;
  return {
    id: row.publicId,
    bookingDate: row.bookingDate,
    valutaDate: row.valueDate ?? undefined,
    amountCents: Number(row.amountCents ?? 0),
    currency: row.currency ?? 'EUR',
    direction: Number(row.amountCents ?? 0) >= 0 ? 'in' : 'out',
    accountId: row.accountId ?? 'unknown',
    rawText: row.memo ?? '',
    bankProfile: row.bankProfile ?? row.sourceProfile ?? 'bank',
    category: (row.category as CategoryId) ?? 'other_review',
    categoryConfidence: row.categoryConfidence ?? 0,
    categorySource: (row.categorySource as 'rule' | 'heuristic' | 'fallback' | 'feedback') ?? 'rule',
    categoryRuleId: row.categoryRuleId ?? undefined,
    categoryExplanation: row.categoryExplanation ?? undefined,
    raw: rawObj ? coerceStringRecord(rawObj) : undefined,
    source: (row.source ?? 'manual') as Source,
    sourceProfile: row.sourceProfile ?? null,
    payee: row.payee ?? null,
    memo: row.memo ?? null,
    externalId: row.externalId ?? null,
    referenceId: row.referenceId ?? null,
    isTransfer: Boolean(row.isTransfer),
    isInternalTransfer:
      Boolean(row.isTransfer) &&
      (row.category === 'transfer_internal' || (row.category ? row.category.startsWith('internal') : false)),
    transferLinkId: row.transferLinkId ?? null,
    confidence: row.categoryConfidence ?? null,
    metadata,
  };
}

function mapDbRowToCoreTransaction(row: any): Transaction {
  const raw = parseRaw(row.raw);
  return {
    id: row.publicId,
    source: (row.source ?? 'manual') as Source,
    sourceProfile: row.sourceProfile ?? null,
    accountId: row.accountId ?? 'unknown',
    bookingDate: row.bookingDate,
    valueDate: row.valueDate ?? undefined,
    amountCents: Number(row.amountCents ?? 0),
    currency: row.currency ?? 'EUR',
    payee: row.payee ?? null,
    counterparty: row.counterpartName ?? null,
    memo: row.memo ?? null,
    categoryId: row.category ?? null,
    confidence: row.categoryConfidence ?? undefined,
    externalId: row.externalId ?? null,
    referenceId: row.referenceId ?? null,
    isTransfer: Boolean(row.isTransfer),
    isTransferLikeHint: undefined,
    transferLinkId: row.transferLinkId ?? null,
    raw,
  };
}

function parseRaw(raw: unknown): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function coerceStringRecord(input: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    output[key] = String(value);
  }
  return output;
}

function normalizeMetadata(input: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (value === null) {
      output[key] = null;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      output[key] = value;
    } else {
      output[key] = JSON.stringify(value);
    }
  }
  return output;
}


