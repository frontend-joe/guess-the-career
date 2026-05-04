CREATE TABLE IF NOT EXISTS managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  wikipedia_url TEXT NOT NULL UNIQUE,
  place_of_birth TEXT,
  born TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS manager_career_stints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  years TEXT NOT NULL,
  club TEXT NOT NULL,
  apps INTEGER,
  goals INTEGER,
  stint_type TEXT NOT NULL DEFAULT 'managerial'
);

CREATE TABLE IF NOT EXISTS manager_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  manager_id INTEGER REFERENCES managers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
