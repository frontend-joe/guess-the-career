CREATE TABLE competitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  wikipedia_url TEXT NOT NULL UNIQUE,
  player_of_season_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  manager_of_season_id INTEGER REFERENCES managers(id) ON DELETE SET NULL,
  pfa_toty_match_id INTEGER REFERENCES xi_matches(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE competition_top_scorers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  club TEXT NOT NULL,
  goals INTEGER NOT NULL,
  rank INTEGER NOT NULL
);

CREATE TABLE competition_hat_tricks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  for_club TEXT NOT NULL,
  against_club TEXT NOT NULL
);

CREATE TABLE competition_top_assists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  club TEXT NOT NULL,
  assists INTEGER NOT NULL,
  rank INTEGER NOT NULL
);
