CREATE TABLE nationals_enabled_combos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nationality TEXT NOT NULL,
  club TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(nationality, club)
);

CREATE TABLE nationals_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  nationality TEXT NOT NULL,
  club TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
