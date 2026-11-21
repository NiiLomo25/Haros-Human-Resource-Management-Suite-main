-- Haros HRMIS — Migration 001: Core schema baseline
-- Applied transactionally by electron/main.cjs on first launch and upgrades.

CREATE TABLE IF NOT EXISTS hrmis_schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hrmis_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hrmis_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hrmis_registry (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hrmis_change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  action TEXT NOT NULL,
  record_key TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hrmis_change_log_created ON hrmis_change_log(created_at);
CREATE INDEX IF NOT EXISTS idx_hrmis_kv_updated ON hrmis_kv(updated_at);
