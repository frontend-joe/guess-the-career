-- La Liga Players game: countries (non-Spanish nationalities) whose players
-- turned out for a Spanish club (any division). Mirrors serie_a_*.
-- round_size is the 5/10 selector (players required to complete a round).

CREATE TABLE IF NOT EXISTS la_liga_enabled_countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nationality TEXT NOT NULL UNIQUE,
  round_size INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS la_liga_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  nationality TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
