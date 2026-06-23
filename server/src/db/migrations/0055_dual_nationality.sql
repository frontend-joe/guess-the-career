-- Dual Nationality game: the curated allowlist of footballers (who represented
-- two different major nations) that are included in the playable list.

CREATE TABLE IF NOT EXISTS dual_nationality_included (
  footballer_id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
