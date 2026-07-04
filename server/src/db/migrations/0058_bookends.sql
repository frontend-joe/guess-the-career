-- Bookend Players game: players who started and finished their senior career at
-- the same club (having left and returned). All detected bookends are included
-- by default; bookends_excluded holds the ones unticked in the admin.

CREATE TABLE IF NOT EXISTS bookends_excluded (
  footballer_id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookends_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  footballer_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
