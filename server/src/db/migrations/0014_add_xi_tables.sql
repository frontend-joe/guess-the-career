CREATE TABLE xi_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  wikipedia_url TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  competition TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE xi_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES xi_matches(id) ON DELETE CASCADE,
  team TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  squad_number INTEGER,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX xi_players_match_id ON xi_players(match_id);
CREATE INDEX xi_players_footballer_id ON xi_players(footballer_id);
