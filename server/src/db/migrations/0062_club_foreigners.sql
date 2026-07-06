-- Club Foreigners game: clubs whose senior players span at least 10 distinct
-- nationalities. The game names overseas players (nationality != the club's own
-- country). Mirrors the club_legends_* tables (which group by club).

CREATE TABLE IF NOT EXISTS club_foreigners_enabled_clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS club_foreigners_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  club TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
