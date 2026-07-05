-- International Marksman game: countries with at least 5 players who have 25+
-- senior international goals for that country. Mirrors the international_legends_*
-- tables (which use appearances).

CREATE TABLE IF NOT EXISTS international_marksman_enabled_countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS international_marksman_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
