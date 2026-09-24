CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  receipt_hash TEXT NOT NULL UNIQUE,
  previous_receipt_hash TEXT,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  receipt_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_hash ON receipts(receipt_hash);
