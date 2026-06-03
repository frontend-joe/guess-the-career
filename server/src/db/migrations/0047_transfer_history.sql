-- Transfer History game: scrape a league-season's transfers from transfermarkt.
-- A "window" = one league-season (e.g. La Liga 1997/98). Each selected ("major")
-- transfer becomes a transfer_window_players row. The game round = one window;
-- the player guesses every transfer in it. Mirrors xi_matches / xi_players /
-- xi_schedule. Separate from the older transfers_* (Know Your Transfers) tables.

CREATE TABLE IF NOT EXISTS transfer_windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league TEXT NOT NULL,
  league_code TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  season_label TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transfer_window_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  window_id INTEGER NOT NULL REFERENCES transfer_windows(id) ON DELETE CASCADE,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  nationality TEXT,
  position TEXT,
  from_club TEXT NOT NULL,
  from_club_wikipedia_url TEXT,
  to_club TEXT NOT NULL,
  to_club_wikipedia_url TEXT,
  fee_text TEXT,
  fee_value INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transfer_window_players_window
  ON transfer_window_players(window_id);

CREATE TABLE IF NOT EXISTS transfer_history_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  window_id INTEGER REFERENCES transfer_windows(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
