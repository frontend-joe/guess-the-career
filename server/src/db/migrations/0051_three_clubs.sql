-- Three Clubs game: trios of clubs with at least 3 players who turned out for
-- all three. Mirrors the two_clubs_* tables (which use pairs).

CREATE TABLE IF NOT EXISTS three_clubs_enabled_trios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_a TEXT NOT NULL,
  club_b TEXT NOT NULL,
  club_c TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(club_a, club_b, club_c)
);

CREATE TABLE IF NOT EXISTS three_clubs_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  club_a TEXT NOT NULL,
  club_b TEXT NOT NULL,
  club_c TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
