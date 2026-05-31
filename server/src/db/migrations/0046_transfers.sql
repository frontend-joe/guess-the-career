-- Know Your Transfers game: directional club-to-club transfers (a player whose
-- consecutive senior stints go from one club to the next). Mirrors the
-- two_clubs_* / club_legends_* tables.

CREATE TABLE IF NOT EXISTS transfers_enabled_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_club TEXT NOT NULL,
  to_club TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_club, to_club)
);

CREATE TABLE IF NOT EXISTS transfers_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  from_club TEXT NOT NULL,
  to_club TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
