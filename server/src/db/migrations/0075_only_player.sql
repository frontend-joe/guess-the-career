-- Only Player game: nationality × English-club combos with exactly one qualifying
-- player. Mirrors the nationals tables; the admin curates enabled combos.
CREATE TABLE IF NOT EXISTS only_player_enabled_combos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nationality TEXT NOT NULL,
  club TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(nationality, club)
);

CREATE TABLE IF NOT EXISTS only_player_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  nationality TEXT NOT NULL,
  club TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
