-- Only Player pivot: the curated list is now the source of truth (not DB-derived).
-- Replace the derived-combo model with an editable entries table + entry-keyed schedule.
DROP TABLE IF EXISTS only_player_enabled_combos;
DROP TABLE IF EXISTS only_player_schedule;

CREATE TABLE IF NOT EXISTS only_player_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nationality TEXT NOT NULL,
  club TEXT NOT NULL,
  player_name TEXT NOT NULL,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  period TEXT,
  status TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(nationality, club, player_name)
);

CREATE TABLE IF NOT EXISTS only_player_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  entry_id INTEGER REFERENCES only_player_entries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
