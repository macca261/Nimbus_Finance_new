-- 003_add_transaction_splits.sql
-- 
-- Transaction Splits Migration
-- 
-- Creates the transaction_splits table for the "Splits-Only" reporting architecture.
-- This allows transactions to be split into multiple category allocations,
-- enabling the "PayPal Reimbursement" use case (+€20 Inflow -> Split into multiple contra-expenses).

-- Create transaction_splits table
CREATE TABLE IF NOT EXISTS transaction_splits (
  id TEXT PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  category_id TEXT,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_category_id ON transaction_splits(category_id);

-- Migrate existing transactions: Create one split per transaction with full amount
-- This ensures backward compatibility and moves us to "Splits-Only" architecture
INSERT INTO transaction_splits (id, transaction_id, amount_cents, category_id, memo, created_at)
SELECT 
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || hex(randomblob(1)) || '-' || 
        substr(hex(randomblob(1)), 1, 1) || hex(randomblob(2)) || '-' || hex(randomblob(6))) as id,
  id as transaction_id,
  amountCents as amount_cents,
  category as category_id,
  NULL as memo,
  COALESCE(createdAt, CURRENT_TIMESTAMP) as created_at
FROM transactions
WHERE NOT EXISTS (
  SELECT 1 FROM transaction_splits WHERE transaction_splits.transaction_id = transactions.id
);

-- Add review_status column to transactions if it doesn't exist
-- This tracks whether a transaction has been reviewed/split
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN, so we check via PRAGMA
-- We'll handle this in the ensureSchema function instead

