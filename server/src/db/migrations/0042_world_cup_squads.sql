CREATE TABLE world_cup_squads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  year          INTEGER NOT NULL,
  team          TEXT NOT NULL,
  wikipedia_url TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(year, team)
);

CREATE TABLE world_cup_squad_players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  squad_id      INTEGER NOT NULL REFERENCES world_cup_squads(id) ON DELETE CASCADE,
  footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  shirt_number  INTEGER,
  position      TEXT,
  name          TEXT NOT NULL,
  club          TEXT NOT NULL,
  nationality   TEXT,
  wikipedia_url TEXT
);

CREATE TABLE world_cup_schedule (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL UNIQUE,
  squad_id   INTEGER REFERENCES world_cup_squads(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
