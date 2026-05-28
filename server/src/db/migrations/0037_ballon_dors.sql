CREATE TABLE ballon_dors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  year       INTEGER NOT NULL UNIQUE,
  wikipedia_url TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ballon_dor_players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ballon_dor_id INTEGER NOT NULL REFERENCES ballon_dors(id) ON DELETE CASCADE,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  nationality   TEXT,
  club          TEXT NOT NULL,
  points        REAL,
  rank          INTEGER NOT NULL
);

CREATE TABLE ballon_dor_schedule (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL UNIQUE,
  ballon_dor_id INTEGER REFERENCES ballon_dors(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
