-- Club Marksman game: clubs with at least 5 players who have 100+ total senior
-- goals for that club. Mirrors the club_legends_* tables (which use appearances).

CREATE TABLE IF NOT EXISTS club_marksman_enabled_clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS club_marksman_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  club TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
