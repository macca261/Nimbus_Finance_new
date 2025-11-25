-- 00_init_splits.sql
-- 
-- Transaction Splits Initialization
-- 
-- Creates the transaction_splits table for 1-to-N splits.
-- Adds status column to transactions for inbox workflow.

-- Create transaction_splits table
CREATE TABLE IF NOT EXISTS transaction_splits (
  id TEXT PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  memo TEXT,
  FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_category_id ON transaction_splits(category_id);

-- Add status column to transactions if missing
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- This will be handled in ensureSchema with ensureColumn pattern

