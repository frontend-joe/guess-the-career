-- Serie A Players game: countries (non-Italian nationalities) whose players
-- turned out for an Italian (Serie A / Serie B) club. Mirrors foreigners_*.
-- round_size is the 5/10 selector (players required to complete a round).

CREATE TABLE IF NOT EXISTS serie_a_enabled_countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nationality TEXT NOT NULL UNIQUE,
  round_size INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS serie_a_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  nationality TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
