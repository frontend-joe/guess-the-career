-- Club Legends game: clubs with at least 10 players who have 100+ total senior
-- appearances for that club. Mirrors the two_clubs_* / nationals_* tables.

CREATE TABLE IF NOT EXISTS club_legends_enabled_clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS club_legends_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  club TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
