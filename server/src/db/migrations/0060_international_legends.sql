-- International Legends game: countries with at least 5 players who have 50+
-- senior international appearances for that country. Mirrors the club_legends_*
-- tables (which group by club and use 100 appearances).

CREATE TABLE IF NOT EXISTS international_legends_enabled_countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS international_legends_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
