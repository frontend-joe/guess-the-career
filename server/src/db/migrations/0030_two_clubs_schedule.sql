CREATE TABLE IF NOT EXISTS two_clubs_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  club_a TEXT NOT NULL,
  club_b TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
