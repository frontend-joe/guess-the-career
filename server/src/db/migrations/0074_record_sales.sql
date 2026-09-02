CREATE TABLE IF NOT EXISTS record_sales_clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club TEXT NOT NULL,
  club_wikipedia_url TEXT,
  source_url TEXT NOT NULL UNIQUE,
  transfermarkt_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS record_sales_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES record_sales_clubs(id) ON DELETE CASCADE,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  nationality TEXT,
  position TEXT,
  from_club TEXT NOT NULL,
  from_club_wikipedia_url TEXT,
  fee_text TEXT,
  fee_value INTEGER,
  season_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_record_sales_players_club ON record_sales_players(club_id);

CREATE TABLE IF NOT EXISTS record_sales_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  club_id INTEGER REFERENCES record_sales_clubs(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
