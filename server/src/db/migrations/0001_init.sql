CREATE TABLE IF NOT EXISTS footballers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  wikipedia_url TEXT NOT NULL UNIQUE,
  nationality TEXT,
  position TEXT,
  born TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS career_stints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  footballer_id INTEGER NOT NULL REFERENCES footballers(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  years TEXT NOT NULL,
  club TEXT NOT NULL,
  apps INTEGER,
  goals INTEGER
);

CREATE TABLE IF NOT EXISTS days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
