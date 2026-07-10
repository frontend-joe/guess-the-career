CREATE TABLE IF NOT EXISTS random_lists_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT NOT NULL UNIQUE,
  target INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS random_lists_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  list_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
