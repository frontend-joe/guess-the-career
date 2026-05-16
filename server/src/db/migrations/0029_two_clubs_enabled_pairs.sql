CREATE TABLE IF NOT EXISTS two_clubs_enabled_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_a TEXT NOT NULL,
  club_b TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(club_a, club_b)
);
