-- Uncapped Players game: countries whose (truly uncapped) players are guessed.
-- Mirrors serie_a_* / foreigners_*. round_size is the 5/10/15 selector.

CREATE TABLE IF NOT EXISTS uncapped_enabled_countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nationality TEXT NOT NULL UNIQUE,
  round_size INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS uncapped_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  nationality TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
