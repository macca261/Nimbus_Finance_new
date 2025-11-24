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
import { findRefundPair, linkRefundPair } from './categorization/refundMatcher';
import { findInternalTransferPair, applyInternalTransferFlags, classifySingleSidedSavingsTransfer, classifySingleSidedWalletTransfer } from './categorization/internalTransferMatcher';
import { detectInternalTransfer } from './services/internalTransferService';
import { detectPaymentProviderFunding } from './services/internalTransferService';
import * as accountsService from './services/accountsService';
import { findReimbursementMatchForIncome, applyReimbursementFlags, classifyReimbursementLike } from './categorization/reimbursementMatcher';
import { buildCategorizationExplanation } from './categorization/explanation';
import { isCashWithdrawalLike } from './categorization/cashMatcher';

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
  importBatchId?: string | null
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
  isRefund?: boolean
  isRefunded?: boolean
  refundGroupId?: string | null
  isInternalTransfer?: boolean
  internalTransferDirection?: 'out' | 'in' | null
  internalTransferKind?: 'savings' | 'wallet' | 'other' | 'payment_provider_funding' | null
  internalTransferGroupId?: string | null
  isReimbursement?: boolean
  reimbursementRole?: 'payer' | 'receiver' | null
  reimbursementGroupId?: string | null
  reimbursementShareRatio?: number | null
  bankReferenceId?: string | null
  isPassThrough?: boolean
  passThroughGroupId?: string | null
  isCashWithdrawal?: boolean
  ignoreForReimbursement?: boolean
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
  ensureColumn('importBatchId', "ALTER TABLE transactions ADD COLUMN importBatchId TEXT");
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
  ensureColumn('isRefund', "ALTER TABLE transactions ADD COLUMN isRefund INTEGER DEFAULT 0");
  ensureColumn('isRefunded', "ALTER TABLE transactions ADD COLUMN isRefunded INTEGER DEFAULT 0");
  ensureColumn('refundGroupId', "ALTER TABLE transactions ADD COLUMN refundGroupId TEXT");
  ensureColumn('isInternalTransfer', "ALTER TABLE transactions ADD COLUMN isInternalTransfer INTEGER DEFAULT 0");
  ensureColumn('internalTransferDirection', "ALTER TABLE transactions ADD COLUMN internalTransferDirection TEXT");
  ensureColumn('internalTransferKind', "ALTER TABLE transactions ADD COLUMN internalTransferKind TEXT");
  ensureColumn('internalTransferGroupId', "ALTER TABLE transactions ADD COLUMN internalTransferGroupId TEXT");
  ensureColumn('isReimbursement', "ALTER TABLE transactions ADD COLUMN isReimbursement INTEGER DEFAULT 0");
  ensureColumn('reimbursementRole', "ALTER TABLE transactions ADD COLUMN reimbursementRole TEXT");
  ensureColumn('reimbursementGroupId', "ALTER TABLE transactions ADD COLUMN reimbursementGroupId TEXT");
  ensureColumn('reimbursementShareRatio', "ALTER TABLE transactions ADD COLUMN reimbursementShareRatio REAL");
  ensureColumn('bankReferenceId', "ALTER TABLE transactions ADD COLUMN bankReferenceId TEXT", () => {
    console.log('[migrate] added column transactions.bankReferenceId');
  });
  // Pass-through pairing support
  ensureColumn('isPassThrough', "ALTER TABLE transactions ADD COLUMN isPassThrough INTEGER DEFAULT 0");
  ensureColumn('passThroughGroupId', "ALTER TABLE transactions ADD COLUMN passThroughGroupId TEXT");
  // Cash withdrawal detection
  ensureColumn('isCashWithdrawal', "ALTER TABLE transactions ADD COLUMN isCashWithdrawal INTEGER DEFAULT 0", () => {
    console.log('[migrate] added column transactions.isCashWithdrawal');
  });
  // Paired transaction ID for payment provider funding (architectural purity: separate from generic fromAccountId/toAccountId)
  ensureColumn('pairedTransactionId', "ALTER TABLE transactions ADD COLUMN pairedTransactionId TEXT", () => {
    console.log('[migrate] added column transactions.pairedTransactionId');
  });
  ensureColumn('ignoreForReimbursement', "ALTER TABLE transactions ADD COLUMN ignoreForReimbursement INTEGER DEFAULT 0", () => {
    console.log('[migrate] added column transactions.ignoreForReimbursement');
  });

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

  // Reimbursement allocations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reimbursement_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groupId TEXT NOT NULL,
      inflowTransactionId TEXT NOT NULL,
      expenseTransactionId TEXT NOT NULL,
      allocatedAmountCents INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (groupId, inflowTransactionId, expenseTransactionId)
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_reimbursement_allocations_groupId ON reimbursement_allocations(groupId);`);

  // Accounts table (for metadata like role)
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      iban TEXT,
      name TEXT,
      role TEXT DEFAULT 'spending',
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);
  // Ensure all columns exist (migration-friendly)
  // This must run every time to handle schema evolution
  try {
    const accCols = db.prepare(`PRAGMA table_info('accounts')`).all() as { name: string }[];
    const colNames = new Set(accCols.map(c => c.name));
    
    // Migrate role to type (backward compatibility) - only if role exists but type doesn't
    if (colNames.has('role') && !colNames.has('type')) {
      try {
        db.exec(`ALTER TABLE accounts ADD COLUMN type TEXT`);
        db.exec(`UPDATE accounts SET type = CASE 
          WHEN role = 'savings' THEN 'SAVINGS'
          WHEN role = 'wallet' THEN 'CASH'
          ELSE 'CHECKING'
        END WHERE type IS NULL`);
      } catch (err) {
        console.warn('[migrate] role->type migration failed:', (err as Error)?.message);
      }
    }
    
    // Add new columns (idempotent - will fail silently if column already exists)
    const addColumn = (name: string, sql: string) => {
      if (!colNames.has(name)) {
        try {
          db.exec(sql);
          colNames.add(name); // Update set for subsequent checks
        } catch (err) {
          console.warn(`[migrate] failed to add column accounts.${name}:`, (err as Error)?.message);
        }
      }
    };
    
    addColumn('type', `ALTER TABLE accounts ADD COLUMN type TEXT DEFAULT 'CHECKING'`);
    addColumn('accountNumber', `ALTER TABLE accounts ADD COLUMN accountNumber TEXT`);
    addColumn('isPrimary', `ALTER TABLE accounts ADD COLUMN isPrimary INTEGER DEFAULT 0`);
    addColumn('isArchived', `ALTER TABLE accounts ADD COLUMN isArchived INTEGER DEFAULT 0`);
    addColumn('userId', `ALTER TABLE accounts ADD COLUMN userId TEXT DEFAULT 'default'`);
    // SQLite doesn't allow non-constant defaults in ALTER TABLE, so add without default and backfill
    if (!colNames.has('updatedAt')) {
      try {
        db.exec(`ALTER TABLE accounts ADD COLUMN updatedAt TEXT`);
        // Backfill with current timestamp for existing rows
        db.exec(`UPDATE accounts SET updatedAt = COALESCE(createdAt, datetime('now')) WHERE updatedAt IS NULL`);
      } catch (err) {
        console.warn(`[migrate] failed to add column accounts.updatedAt:`, (err as Error)?.message);
      }
    } else {
      // Backfill any NULL values
      try {
        db.exec(`UPDATE accounts SET updatedAt = COALESCE(createdAt, datetime('now')) WHERE updatedAt IS NULL`);
      } catch (err) {
        // Ignore - might fail if no rows exist
      }
    }
    
    // Ensure role column exists (for backward compatibility)
    addColumn('role', `ALTER TABLE accounts ADD COLUMN role TEXT DEFAULT 'spending'`);
  } catch (err) {
    console.warn('[migrate] accounts table migration error:', (err as Error)?.message || err);
  }
  // Seed accounts from existing transactions (idempotent)
  try {
    seedAccountsFromExistingTransactions(db);
  } catch (e) {
    console.warn('[migrate] account seeding skipped:', (e as Error)?.message || e);
  }

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

  let importColumns = db.prepare(`PRAGMA table_info('imports')`).all() as { name: string }[];
  const ensureImportColumn = (name: string, sql: string) => {
    const exists = importColumns.some(c => c.name === name);
    if (!exists) {
      try {
        db.exec(sql);
      } catch (err) {
        console.warn('[migrate] import column ensure failed:', name, (err as Error)?.message || err);
      }
      importColumns = db.prepare(`PRAGMA table_info('imports')`).all() as { name: string }[];
    }
  };

  ensureImportColumn('batchId', "ALTER TABLE imports ADD COLUMN batchId TEXT");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_imports_createdAt ON imports(createdAt DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_imports_batchId ON imports(batchId);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS normalization_rules (
      id TEXT PRIMARY KEY,
      is_active INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 100,
      matcher TEXT NOT NULL,
      pattern TEXT NOT NULL,
      normalizeTo TEXT NOT NULL,
      categoryHint TEXT,
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updatedAt DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_normalization_rules_priority
    ON normalization_rules(priority ASC, createdAt ASC);
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

  // Quest tables (Quest Engine v0)
  db.exec(`
    CREATE TABLE IF NOT EXISTS quest_definitions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      kind TEXT NOT NULL,
      targetValue REAL NOT NULL,
      unit TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      configJson TEXT,
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updatedAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_quest_definitions_isActive ON quest_definitions(isActive);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_quest_definitions_kind ON quest_definitions(kind);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_quest_states (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL DEFAULT 'default',
      questId TEXT NOT NULL,
      status TEXT NOT NULL,
      currentValue REAL NOT NULL DEFAULT 0,
      targetValue REAL NOT NULL,
      progressPercent REAL NOT NULL DEFAULT 0,
      startedAt TEXT,
      completedAt TEXT,
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updatedAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (questId) REFERENCES quest_definitions(id) ON DELETE CASCADE
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_quest_states_userId ON user_quest_states(userId);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_quest_states_questId ON user_quest_states(questId);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_quest_states_status ON user_quest_states(status);`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_user_quest_states_user_quest ON user_quest_states(userId, questId);`);
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

export type NormalizedCanonicalRow = {
  importBatchId?: string | null;
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
  isRefund?: boolean;
  isRefunded?: boolean;
  refundGroupId?: string | null;
  isInternalTransfer?: boolean;
  internalTransferDirection?: 'out' | 'in' | null;
  internalTransferKind?: 'savings' | 'wallet' | 'other' | 'payment_provider_funding' | null;
  internalTransferGroupId?: string | null;
  isReimbursement?: boolean;
  reimbursementRole?: 'payer' | 'receiver' | null;
  reimbursementGroupId?: string | null;
  reimbursementShareRatio?: number | null;
  bankReferenceId?: string | null;
  isPassThrough?: boolean;
  passThroughGroupId?: string | null;
  isCashWithdrawal?: boolean;
  createdAt: string;
  transactionPayload: Transaction;
  id?: number; // Database ID, added when reading from DB
};

function normalizeCanonicalRow(row: CanonicalRow): NormalizedCanonicalRow {
  const bookingDate = row.bookingDate ?? new Date().toISOString().slice(0, 10);
  const valueDate = row.valueDate ?? bookingDate;
  const amountCents = row.amountCents ?? 0;
  const currency = (row.currency ?? 'EUR').toUpperCase();
  const purpose = row.purpose ?? '';
  const direction = row.direction ?? (amountCents >= 0 ? 'in' : 'out');
  const counterpartName = row.counterpartName ?? null;
  let counterpartyIban = row.counterpartyIban ?? null;
  const accountIban = row.accountIban ?? null;
  const bankProfile = row.bankProfile ?? null;
  
  // Extract IBAN from comdirect purpose text if not already set
  // Format: "IBAN: DE32200411770270381700" or "Kto/IBAN: DE32200411770270381700"
  if (!counterpartyIban && purpose && (bankProfile === 'comdirect' || bankProfile === 'de.comdirect.csv.giro')) {
    const ibanMatch = purpose.match(/\b(?:IBAN|Kto\/IBAN|Konto\/IBAN)[:\s]+(DE[0-9]{20})\b/i);
    if (ibanMatch && ibanMatch[1]) {
      counterpartyIban = ibanMatch[1].toUpperCase();
    }
  }
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
  const isRefund = Boolean(row.isRefund);
  const isRefunded = Boolean(row.isRefunded);
  const refundGroupId = row.refundGroupId ?? null;
  const isInternalTransfer = Boolean(row.isInternalTransfer);
  const internalTransferDirection = row.internalTransferDirection ?? null;
  const internalTransferKind = row.internalTransferKind ?? null;
  const internalTransferGroupId = row.internalTransferGroupId ?? null;
  const isReimbursement = Boolean(row.isReimbursement);
  const reimbursementRole = row.reimbursementRole ?? null;
  const reimbursementGroupId = row.reimbursementGroupId ?? null;
  const reimbursementShareRatio = row.reimbursementShareRatio ?? null;
  const bankReferenceId = row.bankReferenceId ?? null;
  const isPassThrough = Boolean(row.isPassThrough);
  const passThroughGroupId = row.passThroughGroupId ?? null;
  const isCashWithdrawal = Boolean(row.isCashWithdrawal) || isCashWithdrawalLike(purpose, memo, bankProfile);
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
    isRefund,
    isRefunded,
    refundGroupId,
    isInternalTransfer,
    internalTransferDirection,
    internalTransferKind,
    internalTransferGroupId,
    isReimbursement,
    reimbursementRole,
    reimbursementGroupId,
    reimbursementShareRatio,
    bankReferenceId,
    isPassThrough,
    passThroughGroupId,
    isCashWithdrawal,
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
    isRefund,
    isRefunded,
    refundGroupId,
    isInternalTransfer,
    internalTransferDirection,
    internalTransferKind,
    internalTransferGroupId,
    isReimbursement,
    reimbursementRole,
    reimbursementGroupId,
    reimbursementShareRatio,
    bankReferenceId,
    isPassThrough,
    passThroughGroupId,
    isCashWithdrawal,
    createdAt,
    transactionPayload,
    importBatchId: row.importBatchId ?? null,
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
      importBatchId,
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
      confidence,
      isRefund,
      isRefunded,
      refundGroupId,
      isInternalTransfer,
      internalTransferDirection,
      internalTransferKind,
      internalTransferGroupId,
      isReimbursement,
      reimbursementRole,
      reimbursementGroupId,
      reimbursementShareRatio,
      bankReferenceId,
      isPassThrough,
      passThroughGroupId,
      isCashWithdrawal
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
      @importBatchId,
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
      @confidence,
      @isRefund,
      @isRefunded,
      @refundGroupId,
      @isInternalTransfer,
      @internalTransferDirection,
      @internalTransferKind,
      @internalTransferGroupId,
      @isReimbursement,
      @reimbursementRole,
      @reimbursementGroupId,
      @reimbursementShareRatio,
      @bankReferenceId,
      @isPassThrough,
      @passThroughGroupId,
      @isCashWithdrawal
    )
  `);

  // Prepare UPDATE statement for existing rows that get paired with refunds
  const updateRefundStmt = conn.prepare(`
    UPDATE transactions
    SET isRefund = @isRefund,
        isRefunded = @isRefunded,
        refundGroupId = @refundGroupId
    WHERE publicId = @publicId
  `);

  // Prepare UPDATE statement for existing rows that get paired with internal transfers
  const updateInternalTransferStmt = conn.prepare(`
    UPDATE transactions
    SET isInternalTransfer = @isInternalTransfer,
        internalTransferDirection = @internalTransferDirection,
        internalTransferKind = @internalTransferKind,
        internalTransferGroupId = @internalTransferGroupId
    WHERE publicId = @publicId
  `);

  // Prepare UPDATE statement for existing rows that get paired with reimbursements
  const updateReimbursementStmt = conn.prepare(`
    UPDATE transactions
    SET isReimbursement = @isReimbursement,
        reimbursementRole = @reimbursementRole,
        reimbursementGroupId = @reimbursementGroupId,
        reimbursementShareRatio = @reimbursementShareRatio
    WHERE publicId = @publicId
  `);

  const tx = conn.transaction((batch: CanonicalRow[]) => {
    const overrideRules = getAllOverrideRules(conn);
    
    // Normalize all rows first to get accountIds
    const normalizedBatch: NormalizedCanonicalRow[] = [];
    for (const r of batch) {
      const base = normalizeCanonicalRow(r);
      normalizedBatch.push(base);
    }
    
    // Fetch recent transactions for refund matching
    // Group by accountId to optimize queries
    const accountIds = new Set<string>();
    for (const normalized of normalizedBatch) {
      if (normalized.accountId) {
        accountIds.add(normalized.accountId);
      }
    }
    
    // Fetch recent transactions for each account
    // Use a wider window (180 days) to ensure we catch all potential pairs
    // The refundMatcher will enforce the actual 90-day window per pair
    const recentTransactionsMap = new Map<string, NormalizedCanonicalRow[]>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    for (const accountId of accountIds) {
      const recentRows = conn.prepare(`
        SELECT 
          id, publicId, bookingDate, valueDate, amountCents, currency, purpose,
          counterpartName, counterpartyIban, accountIban, bankProfile, rawCode,
          raw, importFile, importBatchId, category, categoryConfidence,
          category_source AS categorySource, category_explanation AS categoryExplanation,
          category_rule_id AS categoryRuleId, direction, fingerprint, createdAt,
          source, sourceProfile, accountId, payee, memo, externalId, referenceId,
          isTransfer, transferLinkId, confidence, isRefund, isRefunded, refundGroupId
        FROM transactions
        WHERE accountId = @accountId
          AND bookingDate >= @cutoffDate
          AND (isRefund = 0 OR isRefund IS NULL)
          AND (isRefunded = 0 OR isRefunded IS NULL)
          AND (refundGroupId IS NULL)
        ORDER BY bookingDate DESC
      `).all({ accountId, cutoffDate: cutoffDateStr }) as any[];
      
      const normalizedRecent: NormalizedCanonicalRow[] = recentRows.map(row => ({
        id: row.id,
        publicId: row.publicId,
        bookingDate: row.bookingDate,
        valueDate: row.valueDate,
        amountCents: row.amountCents,
        currency: row.currency,
        purpose: row.purpose,
        counterpartName: row.counterpartName,
        counterpartyIban: row.counterpartyIban,
        accountIban: row.accountIban,
        bankProfile: row.bankProfile,
        rawCode: row.rawCode,
        raw: row.raw ? JSON.parse(row.raw) : {},
        importFile: row.importFile,
        importBatchId: row.importBatchId,
        category: row.category,
        categoryConfidence: row.categoryConfidence,
        categorySource: row.categorySource,
        categoryExplanation: row.categoryExplanation,
        categoryRuleId: row.categoryRuleId,
        direction: row.direction,
        fingerprint: row.fingerprint,
        source: row.source as Source,
        sourceProfile: row.sourceProfile,
        accountId: row.accountId,
        payee: row.payee,
        memo: row.memo,
        externalId: row.externalId,
        referenceId: row.referenceId,
        isTransfer: Boolean(row.isTransfer),
        transferLinkId: row.transferLinkId,
        confidence: row.confidence,
        isRefund: Boolean(row.isRefund),
        isRefunded: Boolean(row.isRefunded),
        refundGroupId: row.refundGroupId,
        isInternalTransfer: Boolean(row.isInternalTransfer),
        internalTransferDirection: row.internalTransferDirection,
        internalTransferKind: row.internalTransferKind,
        internalTransferGroupId: row.internalTransferGroupId,
        createdAt: row.createdAt,
        transactionPayload: {} as Transaction, // Not needed for matching
      }));
      
      recentTransactionsMap.set(accountId, normalizedRecent);
    }
    
    // Now try refund matching for each row
    for (const base of normalizedBatch) {
      // Try to find a refund pair
      if (base.accountId) {
        const recentTransactions = recentTransactionsMap.get(base.accountId) ?? [];
        // Combine with other rows in the current batch (already normalized, but exclude current row)
        const otherBatchRows = normalizedBatch.filter(n => n.publicId !== base.publicId);
        const allCandidates: NormalizedCanonicalRow[] = [...recentTransactions, ...otherBatchRows];
        
        const matchedPair = findRefundPair(base, allCandidates);
        if (matchedPair) {
          const linked = linkRefundPair(base, matchedPair);
          
          // Determine which side of the pair is the new row
          const isNewRowCharge = base.publicId === linked.charge.publicId;
          
          // Update the new row with refund flags
          if (isNewRowCharge) {
            base.isRefunded = linked.charge.isRefunded;
            base.isRefund = false;
          } else {
            base.isRefund = linked.refund.isRefund;
            base.isRefunded = false;
          }
          base.refundGroupId = linked.refundGroupId;
          
          // Update the existing row in DB
          if (matchedPair.publicId) {
            const existingIsCharge = matchedPair.publicId === linked.charge.publicId;
            updateRefundStmt.run({
              publicId: matchedPair.publicId,
              isRefund: existingIsCharge ? 0 : 1,
              isRefunded: existingIsCharge ? 1 : 0,
              refundGroupId: linked.refundGroupId,
            });
            
            if (process.env.NODE_ENV !== 'production') {
              console.log('[refundMatcher] paired refund', {
                accountId: base.accountId,
                amount: base.amountCents,
                chargeId: linked.charge.publicId,
                refundId: linked.refund.publicId,
                refundGroupId: linked.refundGroupId,
              });
            }
          }
        }
      }
    }
    
    // Internal transfer detection runs here (after refund matching, BEFORE categorization).
    // This ensures the categorization engine sees isInternalTransfer flags and applies appropriate categories.
    // Detection uses account identifiers (IBAN, account number) for reliable matching between user's own accounts.
    // IMPORTANT: This section must remain properly structured with all braces balanced - the detection logic
    // runs within the transaction callback and any syntax errors here will break the entire insertTransactions function.
    // Fetch recent transactions for internal transfer matching (last 30 days, smaller window)
    const internalTransferCutoffDate = new Date();
    internalTransferCutoffDate.setDate(internalTransferCutoffDate.getDate() - 30);
    const internalTransferCutoffDateStr = internalTransferCutoffDate.toISOString().split('T')[0];
    
    // Collect all unique accountIds from batch
    const batchAccountIds = new Set<string>();
    for (const base of normalizedBatch) {
      if (base.accountId) {
        batchAccountIds.add(base.accountId);
      }
    }
    
    // For internal transfers, we need to fetch recent transactions for ALL accounts
    // because internal transfers are between different accounts.
    // First, get all distinct accountIds that have recent transactions
    const allAccountIdsWithRecent = conn.prepare(`
      SELECT DISTINCT accountId
      FROM transactions
      WHERE accountId IS NOT NULL
        AND bookingDate >= @cutoffDate
        AND (isRefund = 0 OR isRefund IS NULL)
        AND (isRefunded = 0 OR isRefunded IS NULL)
        AND (refundGroupId IS NULL)
        AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
        AND (internalTransferGroupId IS NULL)
    `).all({ cutoffDate: internalTransferCutoffDateStr }) as Array<{ accountId: string }>;
    
    const allRecentForInternalTransfers: NormalizedCanonicalRow[] = [];
    
    // Fetch recent transactions for all accounts
    for (const { accountId } of allAccountIdsWithRecent) {
      // Skip if we already fetched this account for refund matching (use existing data)
      if (recentTransactionsMap.has(accountId)) {
        allRecentForInternalTransfers.push(...recentTransactionsMap.get(accountId)!);
        continue;
      }
      
      // Fetch for this account
      const recentRows = conn.prepare(`
        SELECT 
          id, publicId, bookingDate, valueDate, amountCents, currency, purpose,
          counterpartName, counterpartyIban, accountIban, bankProfile, rawCode,
          raw, importFile, importBatchId, category, categoryConfidence,
          category_source AS categorySource, category_explanation AS categoryExplanation,
          category_rule_id AS categoryRuleId, direction, fingerprint, createdAt,
          source, sourceProfile, accountId, payee, memo, externalId, referenceId,
          isTransfer, transferLinkId, confidence, isRefund, isRefunded, refundGroupId,
          isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId
        FROM transactions
        WHERE accountId = @accountId
          AND bookingDate >= @cutoffDate
          AND (isRefund = 0 OR isRefund IS NULL)
          AND (isRefunded = 0 OR isRefunded IS NULL)
          AND (refundGroupId IS NULL)
          AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
          AND (internalTransferGroupId IS NULL)
        ORDER BY bookingDate DESC
      `).all({ accountId, cutoffDate: internalTransferCutoffDateStr }) as any[];
      
      const normalizedRecent: NormalizedCanonicalRow[] = recentRows.map(row => ({
        id: row.id,
        publicId: row.publicId,
        bookingDate: row.bookingDate,
        valueDate: row.valueDate,
        amountCents: row.amountCents,
        currency: row.currency,
        purpose: row.purpose,
        counterpartName: row.counterpartName,
        counterpartyIban: row.counterpartyIban,
        accountIban: row.accountIban,
        bankProfile: row.bankProfile,
        rawCode: row.rawCode,
        raw: row.raw ? JSON.parse(row.raw) : {},
        importFile: row.importFile,
        importBatchId: row.importBatchId,
        category: row.category,
        categoryConfidence: row.categoryConfidence,
        categorySource: row.categorySource,
        categoryExplanation: row.categoryExplanation,
        categoryRuleId: row.categoryRuleId,
        direction: row.direction,
        fingerprint: row.fingerprint,
        source: row.source as Source,
        sourceProfile: row.sourceProfile,
        accountId: row.accountId,
        payee: row.payee,
        memo: row.memo,
        externalId: row.externalId,
        referenceId: row.referenceId,
        isTransfer: Boolean(row.isTransfer),
        transferLinkId: row.transferLinkId,
        confidence: row.confidence,
        isRefund: Boolean(row.isRefund),
        isRefunded: Boolean(row.isRefunded),
        refundGroupId: row.refundGroupId,
        isInternalTransfer: Boolean(row.isInternalTransfer),
        internalTransferDirection: row.internalTransferDirection,
        internalTransferKind: row.internalTransferKind,
        internalTransferGroupId: row.internalTransferGroupId,
        createdAt: row.createdAt,
        transactionPayload: {} as Transaction,
      }));
      
      allRecentForInternalTransfers.push(...normalizedRecent);
    }
    
    // Try internal transfer matching for each row
    for (const base of normalizedBatch) {
      // Skip if already part of a refund pair or internal transfer
      if (base.isRefund || base.isRefunded || base.refundGroupId || 
          base.isInternalTransfer || base.internalTransferGroupId) {
        continue;
      }
      
      // Build candidate list: recent transactions + other batch rows (excluding current)
      const otherBatchRows = normalizedBatch.filter(n => n.publicId !== base.publicId);
      const allCandidates: NormalizedCanonicalRow[] = [...allRecentForInternalTransfers, ...otherBatchRows];
      
      // Build account role maps (by accountId and by IBAN)
      // Use conn (transaction connection) instead of db to ensure we see the latest data
      const accountRows = (conn.prepare(`SELECT id, iban, role FROM accounts`).all() as Array<{ id: string; iban?: string | null; role?: string | null }>) || [];
      const roleById: Record<string, any> = {};
      const roleByIban: Record<string, any> = {};
      for (const ar of accountRows) {
        if (ar?.id) roleById[ar.id] = (ar.role || 'spending') as any;
        if (ar?.iban) roleByIban[String(ar.iban)] = (ar.role || 'spending') as any;
      }

      // First, try the new account-based detection (higher priority, more reliable)
      // Wrap in try-catch to prevent internal transfer detection errors from crashing the import
      let accountBasedDetection: ReturnType<typeof detectInternalTransfer> | null = null;
      try {
        accountBasedDetection = detectInternalTransfer(base, conn, allCandidates);
      } catch (detectionError: any) {
        // Log but don't fail - treat transaction as normal if detection fails
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[internalTransferService] detection error for transaction', {
            publicId: base.publicId,
            accountId: base.accountId,
            error: detectionError?.message || String(detectionError),
          });
        }
        // Continue with normal transaction processing
      }
      
      if (accountBasedDetection?.isInternalTransfer && accountBasedDetection.confidence >= 0.75) {
        // Use account-based detection result
        base.isInternalTransfer = true;
        base.internalTransferDirection = accountBasedDetection.fromAccountId === base.accountId ? 'out' : 'in';
        base.internalTransferKind = accountBasedDetection.kind || 'other';
        // Generate groupId if we have both accounts
        if (accountBasedDetection.fromAccountId && accountBasedDetection.toAccountId) {
          const ids = [accountBasedDetection.fromAccountId, accountBasedDetection.toAccountId].sort();
          base.internalTransferGroupId = `int_${ids[0]}_${ids[1]}`;
        } else {
          base.internalTransferGroupId = `int_single_${base.publicId}`;
        }
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[internalTransferService] detected via account matching', {
            amountCents: base.amountCents,
            fromAccountId: accountBasedDetection.fromAccountId,
            toAccountId: accountBasedDetection.toAccountId,
            kind: accountBasedDetection.kind,
            confidence: accountBasedDetection.confidence,
            reason: accountBasedDetection.reason,
          });
        }
      } else {
        // Fall back to existing pairing logic
        const transferMatch = findInternalTransferPair(base, allCandidates, { daysWindow: 3, accountRoleById: roleById, accountRoleByIban: roleByIban });
        if (transferMatch) {
          const flagged = applyInternalTransferFlags(transferMatch);
        
        // Determine which side of the pair is the new row
        const isNewRowA = base.publicId === flagged.a.publicId;
        
        // Update the new row with internal transfer flags
        if (isNewRowA) {
          base.isInternalTransfer = flagged.a.isInternalTransfer;
          base.internalTransferDirection = flagged.a.internalTransferDirection;
          base.internalTransferKind = flagged.a.internalTransferKind;
          base.internalTransferGroupId = flagged.a.internalTransferGroupId;
        } else {
          base.isInternalTransfer = flagged.b.isInternalTransfer;
          base.internalTransferDirection = flagged.b.internalTransferDirection;
          base.internalTransferKind = flagged.b.internalTransferKind;
          base.internalTransferGroupId = flagged.b.internalTransferGroupId;
        }
        
        // Update the existing row in DB
        const existingRow = isNewRowA ? flagged.b : flagged.a;
        if (existingRow.publicId) {
          updateInternalTransferStmt.run({
            publicId: existingRow.publicId,
            isInternalTransfer: 1,
            internalTransferDirection: existingRow.internalTransferDirection,
            internalTransferKind: existingRow.internalTransferKind,
            internalTransferGroupId: existingRow.internalTransferGroupId,
          });
          
          if (process.env.NODE_ENV !== 'production') {
            console.log('[internalTransferMatcher] paired', {
              amountCents: base.amountCents,
              accountIdA: transferMatch.a.accountId,
              accountIdB: transferMatch.b.accountId,
              kind: transferMatch.kind,
              groupId: transferMatch.groupId,
            });
          }
        }
        }
      }
      
      // If still not detected, try single-sided detection
      if (!base.isInternalTransfer) {
        // Single-sided internal transfer detection (outgoing to any account in accounts table)
        const single = classifySingleSidedSavingsTransfer(base, { accountRoleById: roleById, accountRoleByIban: roleByIban });
        if (single && single.isInternalTransfer) {
          base.isInternalTransfer = true;
          base.internalTransferDirection = single.internalTransferDirection;
          base.internalTransferKind = single.internalTransferKind;
          base.internalTransferGroupId = single.internalTransferGroupId;
          // Persist
          updateInternalTransferStmt.run({
            publicId: base.publicId,
            isInternalTransfer: 1,
            internalTransferDirection: base.internalTransferDirection,
            internalTransferKind: base.internalTransferKind,
            internalTransferGroupId: base.internalTransferGroupId,
          });
          if (process.env.NODE_ENV !== 'production') {
            console.log('[internalTransferMatcher] single-sided internal transfer', {
              amountCents: base.amountCents,
              accountId: base.accountId,
              counterpartyIban: base.counterpartyIban,
              kind: base.internalTransferKind,
              groupId: base.internalTransferGroupId,
            });
          }
        } else {
          // Try Wise wallet top-up detection (single-sided, no IBAN needed)
          const wallet = classifySingleSidedWalletTransfer(base, { accountRoleById: roleById, accountRoleByIban: roleByIban });
          if (wallet && wallet.isInternalTransfer) {
            base.isInternalTransfer = true;
            base.internalTransferDirection = wallet.internalTransferDirection;
            base.internalTransferKind = wallet.internalTransferKind;
            base.internalTransferGroupId = wallet.internalTransferGroupId;
            // Persist
            updateInternalTransferStmt.run({
              publicId: base.publicId,
              isInternalTransfer: 1,
              internalTransferDirection: base.internalTransferDirection,
              internalTransferKind: base.internalTransferKind,
              internalTransferGroupId: base.internalTransferGroupId,
            });
            if (process.env.NODE_ENV !== 'production') {
              console.log('[internalTransferMatcher] single-sided wallet transfer (Wise)', {
                amountCents: base.amountCents,
                accountId: base.accountId,
                kind: base.internalTransferKind,
                groupId: base.internalTransferGroupId,
              });
            }
          }
        }
      }
    }
    
    // Single-row reimbursement classification (keyword-based, before pair matching)
    // This handles obvious reimbursements that don't need pairing
    const reimbursementCutoffDate = new Date();
    reimbursementCutoffDate.setDate(reimbursementCutoffDate.getDate() - 60);
    const reimbursementCutoffDateStr = reimbursementCutoffDate.toISOString().split('T')[0];
    
    // Fetch recent transactions for context (for P2P matching)
    const recentForContext: NormalizedCanonicalRow[] = [];
    const reimbursementAccountIds = new Set<string>();
    for (const base of normalizedBatch) {
      if (base.accountId) {
        reimbursementAccountIds.add(base.accountId);
      }
    }
    
    for (const accountId of reimbursementAccountIds) {
      const recentRows = conn.prepare(`
        SELECT 
          id, publicId, bookingDate, valueDate, amountCents, currency, purpose,
          counterpartName, counterpartyIban, accountIban, bankProfile, rawCode,
          raw, importFile, importBatchId, category, categoryConfidence,
          category_source AS categorySource, category_explanation AS categoryExplanation,
          category_rule_id AS categoryRuleId, direction, fingerprint, createdAt,
          source, sourceProfile, accountId, payee, memo, externalId, referenceId,
          isTransfer, transferLinkId, confidence, isRefund, isRefunded, refundGroupId,
          isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId,
          isReimbursement, reimbursementRole, reimbursementGroupId, reimbursementShareRatio
        FROM transactions
        WHERE accountId = @accountId
          AND bookingDate >= @cutoffDate
          AND (isRefund = 0 OR isRefund IS NULL)
          AND (isRefunded = 0 OR isRefunded IS NULL)
          AND (refundGroupId IS NULL)
          AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
          AND (internalTransferGroupId IS NULL)
        ORDER BY bookingDate DESC
        LIMIT 100
      `).all({ accountId, cutoffDate: reimbursementCutoffDateStr }) as any[];
      
      const normalizedRecent: NormalizedCanonicalRow[] = recentRows.map(row => ({
        id: row.id,
        publicId: row.publicId,
        bookingDate: row.bookingDate,
        valueDate: row.valueDate,
        amountCents: row.amountCents,
        currency: row.currency,
        purpose: row.purpose,
        counterpartName: row.counterpartName,
        counterpartyIban: row.counterpartyIban,
        accountIban: row.accountIban,
        bankProfile: row.bankProfile,
        rawCode: row.rawCode,
        raw: row.raw ? JSON.parse(row.raw) : {},
        importFile: row.importFile,
        importBatchId: row.importBatchId,
        category: row.category,
        categoryConfidence: row.categoryConfidence,
        categorySource: row.categorySource,
        categoryExplanation: row.categoryExplanation,
        categoryRuleId: row.categoryRuleId,
        direction: row.direction,
        fingerprint: row.fingerprint,
        source: row.source as Source,
        sourceProfile: row.sourceProfile,
        accountId: row.accountId,
        payee: row.payee,
        memo: row.memo,
        externalId: row.externalId,
        referenceId: row.referenceId,
        isTransfer: Boolean(row.isTransfer),
        transferLinkId: row.transferLinkId,
        confidence: row.confidence,
        isRefund: Boolean(row.isRefund),
        isRefunded: Boolean(row.isRefunded),
        refundGroupId: row.refundGroupId,
        isInternalTransfer: Boolean(row.isInternalTransfer),
        internalTransferDirection: row.internalTransferDirection,
        internalTransferKind: row.internalTransferKind,
        internalTransferGroupId: row.internalTransferGroupId,
        isReimbursement: Boolean(row.isReimbursement),
        reimbursementRole: row.reimbursementRole,
        reimbursementGroupId: row.reimbursementGroupId,
        reimbursementShareRatio: row.reimbursementShareRatio,
        createdAt: row.createdAt,
        transactionPayload: {} as Transaction,
      }));
      
      recentForContext.push(...normalizedRecent);
    }
    
    // Add current batch to context (for P2P matching within the same batch)
    const allRecentForContext = [...recentForContext, ...normalizedBatch];
    
    // Apply single-row reimbursement classification
    for (const base of normalizedBatch) {
      if (base.isRefund || base.isRefunded || base.refundGroupId) continue;
      if (base.isInternalTransfer || base.internalTransferGroupId) continue;
      if (base.isReimbursement || base.reimbursementGroupId) continue;
      
      const classification = classifyReimbursementLike(base, {
        recentTransactions: allRecentForContext,
        daysWindow: 30,
      });
      
      if (classification) {
        base.isReimbursement = true;
        base.reimbursementRole = classification.reimbursementRole;
        base.reimbursementGroupId = classification.reimbursementGroupId;
        base.reimbursementShareRatio = classification.reimbursementShareRatio ?? null;
        
        // Persist immediately
        updateReimbursementStmt.run({
          publicId: base.publicId,
          isReimbursement: 1,
          reimbursementRole: classification.reimbursementRole,
          reimbursementGroupId: classification.reimbursementGroupId,
          reimbursementShareRatio: classification.reimbursementShareRatio ?? null,
        });
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[reimbursementMatcher] keyword-based classification', {
            publicId: base.publicId,
            role: classification.reimbursementRole,
            groupId: classification.reimbursementGroupId,
            amountCents: base.amountCents,
          });
        }
      }
    }
    
    // Categorize rows that don't have categories yet (AFTER internal transfer matching)
    // The categorization engine will see isInternalTransfer flags and apply internal transfer categories
    for (const base of normalizedBatch) {
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
          transaction: {
            ...base.transactionPayload,
            // Pass internal transfer flags to categorization engine
            isInternalTransfer: base.isInternalTransfer ?? false,
            internalTransferKind: base.internalTransferKind ?? null,
            internalTransferDirection: base.internalTransferDirection ?? null,
          },
          overrideMatch: overrideMatch ? { ruleId: overrideMatch.rule.id, categoryId: overrideMatch.categoryId } : undefined,
        });
        base.category = result.category;
        base.categorySource = result.source;
        base.categoryConfidence = result.confidence;
        base.categoryExplanation = result.explanation ?? null;
        base.categoryRuleId = result.ruleId ?? null;
      }
    }
    
    // Now try reimbursement matching for each income row (after refund + internal transfer matching)
    // Gather all new normalized rows that are not already part of refund/internal transfer pairs
    const eligibleForReimbursement = normalizedBatch.filter(
      r => !r.isRefund && !r.isRefunded && !r.refundGroupId &&
           !r.isInternalTransfer && !r.internalTransferGroupId
    );
    
    const newIncomes = eligibleForReimbursement.filter(r => r.amountCents > 0);
    const newExpenses = eligibleForReimbursement.filter(r => r.amountCents < 0);
    
    // Fetch recent expenses from DB (last 60 days) as match candidates
    // Reuse the reimbursementCutoffDate, reimbursementCutoffDateStr, and reimbursementAccountIds already declared above for single-row classification
    
    const recentExpensesFromDb: NormalizedCanonicalRow[] = [];
    for (const accountId of reimbursementAccountIds) {
      const recentRows = conn.prepare(`
        SELECT 
          id, publicId, bookingDate, valueDate, amountCents, currency, purpose,
          counterpartName, counterpartyIban, accountIban, bankProfile, rawCode,
          raw, importFile, importBatchId, category, categoryConfidence,
          category_source AS categorySource, category_explanation AS categoryExplanation,
          category_rule_id AS categoryRuleId, direction, fingerprint, createdAt,
          source, sourceProfile, accountId, payee, memo, externalId, referenceId,
          isTransfer, transferLinkId, confidence, isRefund, isRefunded, refundGroupId,
          isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId,
          isReimbursement, reimbursementRole, reimbursementGroupId, reimbursementShareRatio
        FROM transactions
        WHERE accountId = @accountId
          AND amountCents < 0
          AND bookingDate >= @cutoffDate
          AND (isRefund = 0 OR isRefund IS NULL)
          AND (isRefunded = 0 OR isRefunded IS NULL)
          AND (refundGroupId IS NULL)
          AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
          AND (internalTransferGroupId IS NULL)
          AND (isReimbursement = 0 OR isReimbursement IS NULL)
          AND (reimbursementGroupId IS NULL)
        ORDER BY bookingDate DESC
      `).all({ accountId, cutoffDate: reimbursementCutoffDateStr }) as any[];
      
      const normalizedRecent: NormalizedCanonicalRow[] = recentRows.map(row => ({
        id: row.id,
        publicId: row.publicId,
        bookingDate: row.bookingDate,
        valueDate: row.valueDate,
        amountCents: row.amountCents,
        currency: row.currency,
        purpose: row.purpose,
        counterpartName: row.counterpartName,
        counterpartyIban: row.counterpartyIban,
        accountIban: row.accountIban,
        bankProfile: row.bankProfile,
        rawCode: row.rawCode,
        raw: row.raw ? JSON.parse(row.raw) : {},
        importFile: row.importFile,
        importBatchId: row.importBatchId,
        category: row.category,
        categoryConfidence: row.categoryConfidence,
        categorySource: row.categorySource,
        categoryExplanation: row.categoryExplanation,
        categoryRuleId: row.categoryRuleId,
        direction: row.direction,
        fingerprint: row.fingerprint,
        source: row.source as Source,
        sourceProfile: row.sourceProfile,
        accountId: row.accountId,
        payee: row.payee,
        memo: row.memo,
        externalId: row.externalId,
        referenceId: row.referenceId,
        isTransfer: Boolean(row.isTransfer),
        transferLinkId: row.transferLinkId,
        confidence: row.confidence,
        isRefund: Boolean(row.isRefund),
        isRefunded: Boolean(row.isRefunded),
        refundGroupId: row.refundGroupId,
        isInternalTransfer: Boolean(row.isInternalTransfer),
        internalTransferDirection: row.internalTransferDirection,
        internalTransferKind: row.internalTransferKind,
        internalTransferGroupId: row.internalTransferGroupId,
        isReimbursement: Boolean(row.isReimbursement),
        reimbursementRole: row.reimbursementRole,
        reimbursementGroupId: row.reimbursementGroupId,
        reimbursementShareRatio: row.reimbursementShareRatio,
        createdAt: row.createdAt,
        transactionPayload: {} as Transaction,
      }));
      
      recentExpensesFromDb.push(...normalizedRecent);
    }
    
    // Try reimbursement matching for each income
    for (const income of newIncomes) {
      // Skip if already part of a reimbursement
      if (income.isReimbursement || income.reimbursementGroupId) {
        continue;
      }
      
      // Build candidate expense list
      const candidateExpenses = [
        ...recentExpensesFromDb,
        ...newExpenses,
      ].filter(e =>
        e.publicId !== income.publicId &&
        !e.isRefund &&
        !e.isRefunded &&
        !e.refundGroupId &&
        !e.isInternalTransfer &&
        !e.internalTransferGroupId &&
        !e.isReimbursement &&
        !e.reimbursementGroupId
      );
      
      const reimbursementMatch = findReimbursementMatchForIncome(income, candidateExpenses, {
        daysWindow: 30,
        minRatio: 0.25,
        maxRatio: 1.0,
      });
      
      if (reimbursementMatch) {
        const flagged = applyReimbursementFlags(reimbursementMatch);
        
        // Update the income row (new row) with reimbursement flags
        income.isReimbursement = flagged.income.isReimbursement;
        income.reimbursementRole = flagged.income.reimbursementRole;
        income.reimbursementGroupId = flagged.income.reimbursementGroupId;
        income.reimbursementShareRatio = flagged.income.reimbursementShareRatio;
        
        // Update the expense row
        // Check if expense is in the current batch or in DB
        const expenseInBatch = normalizedBatch.find(n => n.publicId === flagged.expense.publicId);
        
        if (expenseInBatch) {
          // Update in-memory batch row
          expenseInBatch.isReimbursement = flagged.expense.isReimbursement;
          expenseInBatch.reimbursementRole = flagged.expense.reimbursementRole;
          expenseInBatch.reimbursementGroupId = flagged.expense.reimbursementGroupId;
          expenseInBatch.reimbursementShareRatio = flagged.expense.reimbursementShareRatio;
        } else if (flagged.expense.publicId) {
          // Update existing row in DB
          updateReimbursementStmt.run({
            publicId: flagged.expense.publicId,
            isReimbursement: 1,
            reimbursementRole: flagged.expense.reimbursementRole,
            reimbursementGroupId: flagged.expense.reimbursementGroupId,
            reimbursementShareRatio: flagged.expense.reimbursementShareRatio,
          });
        }
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[reimbursementMatcher] matched', {
            expenseId: reimbursementMatch.expense.publicId,
            incomeId: reimbursementMatch.income.publicId,
            shareRatio: reimbursementMatch.shareRatio,
            groupId: reimbursementMatch.groupId,
          });
        }
      }
    }
    
    // Apply internal categories for internal transfers (do not override refunds/reimbursements/pass-through)
    // Note: The categorization engine should have already set the category via the internal transfer override,
    // but we ensure it here as a safety net
    for (const base of normalizedBatch) {
      if (base.isInternalTransfer && !base.isRefund && !base.isRefunded && !base.isReimbursement) {
        const cat = (base.category ?? '').trim();
        // Check if it's already an internal transfer category (new format: internal:transfer_*)
        const isInternalTransferCat = cat.startsWith('internal:transfer_');
        if (!isInternalTransferCat) {
          let categoryId: CategoryId;
          switch (base.internalTransferKind) {
            case 'savings':
              categoryId = 'internal:transfer_savings' as any;
              break;
            case 'wallet':
              categoryId = 'internal:transfer_wallet' as any;
              break;
            case 'payment_provider_funding':
              categoryId = 'internal:transfer_other' as any; // Use 'other' category for payment provider funding
              break;
            default:
              categoryId = 'internal:transfer_other' as any;
          }
          (base as any).category = categoryId;
          (base as any).categorySource = 'system';
          (base as any).categoryRuleId = 'internal_transfer:auto';
        }
      }
    }
    
    // Insert all normalized rows
    for (const base of normalizedBatch) {
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
        importBatchId: base.importBatchId ?? null,
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
        isRefund: base.isRefund ? 1 : 0,
        isRefunded: base.isRefunded ? 1 : 0,
        refundGroupId: base.refundGroupId,
        isInternalTransfer: base.isInternalTransfer ? 1 : 0,
        internalTransferDirection: base.internalTransferDirection,
        internalTransferKind: base.internalTransferKind,
        internalTransferGroupId: base.internalTransferGroupId,
        isReimbursement: base.isReimbursement ? 1 : 0,
        reimbursementRole: base.reimbursementRole,
        reimbursementGroupId: base.reimbursementGroupId,
        reimbursementShareRatio: base.reimbursementShareRatio,
        bankReferenceId: base.bankReferenceId,
        isPassThrough: base.isPassThrough ? 1 : 0,
        passThroughGroupId: base.passThroughGroupId,
        isCashWithdrawal: base.isCashWithdrawal ? 1 : 0,
      });

      if ((info as any).changes === 1) inserted++;
      else duplicates++;
    }
    // After batch insert, opportunistically seed accounts for any new account keys present in this batch
    try {
      const keys: Array<{ accountId?: string | null; accountIban?: string | null }> = [];
      for (const b of normalizedBatch) {
        keys.push({ accountId: b.accountId ?? null, accountIban: b.accountIban ?? null });
      }
      const distinct = new Map<string, { accountId?: string | null; accountIban?: string | null }>();
      for (const k of keys) {
        const id = (k.accountId && k.accountId.trim()) ? k.accountId.trim() : (k.accountIban && k.accountIban.trim()) ? k.accountIban.trim() : null;
        if (!id) continue;
        if (!distinct.has(id)) distinct.set(id, k);
      }
      if (distinct.size > 0) {
        const insertAcc = conn.prepare(`INSERT OR IGNORE INTO accounts (id, iban, name, role) VALUES (?, ?, ?, 'spending')`);
        for (const [id, k] of distinct) {
          const iban = k.accountIban && k.accountIban.trim() ? k.accountIban.trim() : null;
          const suffix = iban ? iban.slice(-4) : id.slice(-4);
          const name = `Konto ${suffix}`;
          insertAcc.run(id, iban, name);
        }
      }
    } catch {}
  });

  try { console.log('[insert] starting tx, rows=' + rows.length); } catch {}
  tx(rows);
  try { console.log('[insert] inserted=' + inserted + ' duplicates=' + duplicates); } catch {}
  
  // Payment provider internal transfer detection: bank → PayPal funding
  // Run after all transactions are inserted and accounts are created/linked
  // This ensures we can find both the bank and PayPal accounts
  // Note: detectPaymentProviderFunding is synchronous (better-sqlite3)
  try {
    detectPaymentProviderFunding(conn, { windowDays: 2 });
  } catch (error: any) {
    // Log but don't fail - detection is best-effort
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[insert] Payment provider funding detection failed:', error?.message || error);
    }
  }
  
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

// Seed accounts table based on distinct accounts seen in transactions
export function seedAccountsFromExistingTransactions(conn: Database = db): void {
  // Collect distinct account keys from transactions, including source profile for payment provider detection
  const rows = conn.prepare(`
    SELECT DISTINCT
      COALESCE(NULLIF(TRIM(accountId), ''), NULL) AS accountId,
      COALESCE(NULLIF(TRIM(accountIban), ''), NULL) AS accountIban,
      COALESCE(NULLIF(TRIM(sourceProfile), ''), NULL) AS sourceProfile,
      COALESCE(NULLIF(TRIM(source), ''), NULL) AS source
    FROM transactions
    WHERE (accountId IS NOT NULL AND TRIM(accountId) <> '')
       OR (accountIban IS NOT NULL AND TRIM(accountIban) <> '')
  `).all() as Array<{ 
    accountId?: string | null; 
    accountIban?: string | null;
    sourceProfile?: string | null;
    source?: string | null;
  }>;
  if (!rows || rows.length === 0) return;
  
  // Use accountsService to create accounts with auto-detection of payment provider type
  
  const tx = conn.transaction((batch: typeof rows) => {
    for (const r of batch) {
      const id = (r.accountId && r.accountId.trim()) ? r.accountId.trim() : (r.accountIban && r.accountIban.trim()) ? r.accountIban.trim() : null;
      if (!id) continue;
      
      // Check if account already exists
      const existing = accountsService.getAccountById(conn, id);
      if (existing) {
        // Account exists - check if it should be upgraded to PAYMENT_PROVIDER
        if (existing.type !== 'PAYMENT_PROVIDER') {
          const accountName = existing.name || id;
          const importSource = r.source === 'csv_paypal' ? 'csv_paypal' : r.sourceProfile || null;
          if (accountsService.shouldBePaymentProviderAccount(accountName, importSource)) {
            // Upgrade existing account to PAYMENT_PROVIDER (idempotent)
            try {
              conn.prepare(`UPDATE accounts SET type = 'PAYMENT_PROVIDER', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
              if (process.env.NODE_ENV !== 'production') {
                console.log('[seedAccounts] Upgraded account to PAYMENT_PROVIDER', { id, name: accountName });
              }
            } catch (err) {
              // Ignore errors (e.g., type column might not exist in old schema)
            }
          }
        }
        continue; // Account already exists
      }
      
      // Create new account with auto-detection
      const iban = r.accountIban && r.accountIban.trim() ? r.accountIban.trim() : null;
      const suffix = iban ? iban.slice(-4) : id.slice(-4);
      const name = `Konto ${suffix}`;
      const importSource = r.source === 'csv_paypal' ? 'csv_paypal' : r.sourceProfile || null;
      
      try {
        accountsService.createAccount(conn, {
          id,
          name,
          iban: iban || undefined,
          type: accountsService.shouldBePaymentProviderAccount(name, importSource) ? 'PAYMENT_PROVIDER' : 'CHECKING',
        }, undefined, importSource);
      } catch (err: any) {
        // If creation fails (e.g., account already exists from concurrent insert), ignore
        if (process.env.NODE_ENV !== 'production' && !err?.message?.includes('UNIQUE constraint')) {
          console.warn('[seedAccounts] Failed to create account', { id, name, error: err?.message });
        }
      }
    }
  });
  tx(rows);
}

// Backfill helper to set internal categories for existing internal transfers
export function backfillInternalTransferCategories(conn: Database = db): number {
  const rows = conn.prepare(`
    SELECT id, internalTransferKind
    FROM transactions
    WHERE isInternalTransfer = 1
      AND (category NOT IN ('internal:savings','internal:wallet','internal:own-account') OR category IS NULL)
      AND (isRefund = 0 OR isRefund IS NULL)
      AND (isRefunded = 0 OR isRefunded IS NULL)
      AND (isReimbursement = 0 OR isReimbursement IS NULL)
  `).all() as Array<{ id: number; internalTransferKind?: string | null }>;
  if (!rows || rows.length === 0) return 0;
  const update = conn.prepare(`UPDATE transactions SET category = ?, category_source = 'system', category_rule_id = 'internal_transfer:auto' WHERE id = ?`);
  let changes = 0;
  const tx = conn.transaction((batch: typeof rows) => {
    for (const r of batch) {
      let cat: string = 'internal:own-account';
      if ((r.internalTransferKind || '') === 'savings') cat = 'internal:savings';
      else if ((r.internalTransferKind || '') === 'wallet') cat = 'internal:wallet';
      const res = update.run(cat, r.id);
      changes += res?.changes ?? 0;
    }
  });
  tx(rows);
  return changes;
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
  batchId?: string | null;
}

export function recordImport(meta: ImportMeta, conn: Database = db) {
  const stmt = conn.prepare(`
    INSERT INTO imports (profileId, fileName, confidence, transactionCount, warnings, batchId)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    meta.profileId,
    meta.fileName,
    meta.confidence,
    meta.transactionCount,
    JSON.stringify(meta.warnings ?? []),
    meta.batchId ?? null,
  );
  return Number(result.lastInsertRowid);
}

export function getLastImport(conn: Database = db) {
  const row = conn
    .prepare(
      `SELECT id, profileId, fileName, confidence, transactionCount, warnings, createdAt, batchId
       FROM imports
       ORDER BY datetime(createdAt) DESC
       LIMIT 1`,
    )
    .get() as
    | {
        id: number;
        profileId: string;
        fileName: string;
        confidence: number;
        transactionCount: number;
        warnings: string | null;
        createdAt: string;
        batchId: string | null;
      }
    | undefined;
  if (!row) return null;
  const { id, ...rest } = row;
  return {
    id,
    ...rest,
    warnings: row.warnings ? (JSON.parse(row.warnings) as string[]) : [],
  };
}

export function getRecentImports(limit = 10, conn: Database = db) {
  const rows = conn
    .prepare(
      `SELECT id,
              profileId,
              fileName,
              confidence,
              transactionCount,
              warnings,
              createdAt,
              batchId
       FROM imports
       ORDER BY datetime(createdAt) DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    profileId: string;
    fileName: string;
    confidence: number;
    transactionCount: number;
    warnings: string | null;
    createdAt: string;
    batchId: string | null;
  }>;

  return rows.map(row => ({
    id: row.id,
    profileId: row.profileId,
    fileName: row.fileName,
    confidence: row.confidence,
    transactionCount: row.transactionCount,
    warnings: row.warnings ? (JSON.parse(row.warnings) as string[]) : [],
    createdAt: row.createdAt,
    batchId: row.batchId ?? null,
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
    .prepare(`SELECT publicId, source, sourceProfile, bankProfile, accountId, bookingDate, valueDate, amountCents, currency, payee, counterpartName, memo, category, categoryConfidence, externalId, referenceId, isTransfer, transferLinkId, isRefund, isRefunded, refundGroupId, isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId, isReimbursement, reimbursementRole, reimbursementGroupId, reimbursementShareRatio, bankReferenceId, raw FROM transactions WHERE source = @source AND (transferLinkId IS NULL OR transferLinkId = '')`)
    .all({ source: 'csv_paypal' });
  const bankRows = conn
    .prepare(`SELECT publicId, source, sourceProfile, bankProfile, accountId, bookingDate, valueDate, amountCents, currency, payee, counterpartName, memo, category, categoryConfidence, externalId, referenceId, isTransfer, transferLinkId, isRefund, isRefunded, refundGroupId, isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId, isReimbursement, reimbursementRole, reimbursementGroupId, reimbursementShareRatio, bankReferenceId, raw FROM transactions WHERE source = @source AND (transferLinkId IS NULL OR transferLinkId = '')`)
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
    .prepare(`SELECT publicId, source, sourceProfile, accountId, bookingDate, valueDate, amountCents, currency, payee, counterpartName, memo, category, categoryConfidence, externalId, referenceId, isTransfer, transferLinkId, isRefund, isRefunded, refundGroupId, isInternalTransfer, internalTransferDirection, internalTransferKind, internalTransferGroupId, isReimbursement, reimbursementRole, reimbursementGroupId, reimbursementShareRatio, bankReferenceId, raw FROM transactions WHERE publicId = @publicId LIMIT 1`)
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

export function deleteOverrideRule(id: string, conn: Database = db): boolean {
  const result = conn
    .prepare(`DELETE FROM user_override_rules WHERE id = @id`)
    .run({ id });
  return (result.changes ?? 0) > 0;
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

export function applyOverrideRuleToExistingTransactions(
  ruleId: string,
  conn: Database = db
): { updatedCount: number } {
  // Load the rule
  const ruleRow = conn
    .prepare(`SELECT id, patternType, pattern, categoryId FROM user_override_rules WHERE id = @id`)
    .get({ id: ruleId }) as {
    id: string;
    patternType: string;
    pattern: string;
    categoryId: string;
  } | undefined;

  if (!ruleRow) {
    return { updatedCount: 0 };
  }

  const pattern = ruleRow.pattern.toLowerCase();
  const categoryId = ruleRow.categoryId;
  const ruleIdValue = `user_override:${ruleRow.id}`;

  // Build WHERE clause with safety exclusions
  const exclusionClause = `
    AND (isRefund = 0 OR isRefund IS NULL)
    AND (isRefunded = 0 OR isRefunded IS NULL)
    AND (isInternalTransfer = 0 OR isInternalTransfer IS NULL)
    AND (isReimbursement = 0 OR isReimbursement IS NULL)
  `;

  let sql = '';
  const params: any = { pattern, categoryId, ruleId: ruleIdValue };

  switch (ruleRow.patternType) {
    case 'payee':
      // Check both payee and counterpartName for payee rules
      sql = `
        UPDATE transactions
        SET category = @categoryId,
            category_source = 'user',
            category_rule_id = @ruleId
        WHERE (
          LOWER(COALESCE(payee, '')) LIKE '%' || @pattern || '%'
          OR LOWER(COALESCE(counterpartName, '')) LIKE '%' || @pattern || '%'
        )
        ${exclusionClause}
      `;
      break;
    case 'memo':
      // Check both memo and purpose for memo rules
      sql = `
        UPDATE transactions
        SET category = @categoryId,
            category_source = 'user',
            category_rule_id = @ruleId
        WHERE (
          LOWER(COALESCE(memo, '')) LIKE '%' || @pattern || '%'
          OR LOWER(COALESCE(purpose, '')) LIKE '%' || @pattern || '%'
        )
        ${exclusionClause}
      `;
      break;
    case 'iban':
      sql = `
        UPDATE transactions
        SET category = @categoryId,
            category_source = 'user',
            category_rule_id = @ruleId
        WHERE REPLACE(LOWER(COALESCE(counterpartyIban, '')), ' ', '') = @pattern
        ${exclusionClause}
      `;
      break;
    case 'fingerprint':
      sql = `
        UPDATE transactions
        SET category = @categoryId,
            category_source = 'user',
            category_rule_id = @ruleId
        WHERE publicId = @pattern
        ${exclusionClause}
      `;
      break;
    default:
      return { updatedCount: 0 };
  }

  const result = conn.prepare(sql).run(params);
  return { updatedCount: result.changes ?? 0 };
}

function mapDbRowToNormalizedTransaction(row: any): NormalizedTransaction {
  const rawObj = parseRaw(row.raw);
  const metadata = rawObj && rawObj.metadata && typeof rawObj.metadata === 'object' ? normalizeMetadata(rawObj.metadata as Record<string, unknown>) : undefined;
  if (rawObj?.metadata) delete rawObj.metadata;
  const tx: NormalizedTransaction = {
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
    isInternalTransfer: Boolean(row.isInternalTransfer) ||
      (Boolean(row.isTransfer) &&
      (row.category === 'transfer_internal' || (row.category ? row.category.startsWith('internal') : false))),
    transferLinkId: row.transferLinkId ?? null,
    confidence: row.categoryConfidence ?? null,
    metadata,
    isRefund: Boolean(row.isRefund),
    isRefunded: Boolean(row.isRefunded),
    refundGroupId: row.refundGroupId ?? null,
    internalTransferDirection: row.internalTransferDirection ?? null,
    internalTransferKind: row.internalTransferKind ?? null,
    internalTransferGroupId: row.internalTransferGroupId ?? null,
    isReimbursement: Boolean(row.isReimbursement),
    reimbursementRole: row.reimbursementRole ?? null,
    reimbursementGroupId: row.reimbursementGroupId ?? null,
    reimbursementShareRatio: row.reimbursementShareRatio ?? null,
    bankReferenceId: row.bankReferenceId ?? null,
  };
  
  // Add categorization explanation
  const explanation = buildCategorizationExplanation(tx);
  tx.categorizationReasonCode = explanation.code;
  tx.categorizationReasonText = explanation.text;
  
  return tx;
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
    isRefund: Boolean(row.isRefund),
    isRefunded: Boolean(row.isRefunded),
    refundGroupId: row.refundGroupId ?? null,
    isInternalTransfer: Boolean(row.isInternalTransfer),
    internalTransferDirection: row.internalTransferDirection ?? null,
    internalTransferKind: row.internalTransferKind ?? null,
    internalTransferGroupId: row.internalTransferGroupId ?? null,
    isReimbursement: Boolean(row.isReimbursement),
    reimbursementRole: row.reimbursementRole ?? null,
    reimbursementGroupId: row.reimbursementGroupId ?? null,
    reimbursementShareRatio: row.reimbursementShareRatio ?? null,
    bankReferenceId: row.bankReferenceId ?? null,
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


