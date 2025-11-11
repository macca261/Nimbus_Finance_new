-- 002_add_category_fields.sql

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_source TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_confidence REAL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_explanation TEXT;

CREATE INDEX IF NOT EXISTS idx_tx_bookingDate ON transactions(bookingDate);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);


