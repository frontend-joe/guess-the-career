-- A Tenable round frozen for one room.
--
-- 0079_tenable.sql deliberately derives answers at query time so rounds stay
-- correct as the scraped data improves. That is right for solo play and wrong
-- for a shared, recorded game: two players would get two independent
-- recomputations, and POST /api/tenable/verify inserts new footballers and
-- recomputes, which can push the tenth answer off the board underneath
-- everyone mid-round.
--
-- So a room freezes the board at kick-off. THE INVARIANT: once a round
-- instance exists, the Tenable derivation engine has no further say over it.
-- Everything downstream reads game_round_answers, never answersForRound().
--
-- Freeze and start are separate steps. The derivation SQL is a heavy aggregate
-- for several round types and runs during the lobby, because started_at_ms is
-- the zero point for every timestamp in the round and every media file that
-- will later be aligned against it — it has to be a cheap, precise instant.
CREATE TABLE IF NOT EXISTS game_round_instances (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id        INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  round_id       INTEGER NOT NULL REFERENCES tenable_rounds(id) ON DELETE RESTRICT,
  seq            INTEGER NOT NULL,
  type           TEXT    NOT NULL,
  params_json    TEXT    NOT NULL,
  metric         TEXT    NOT NULL,
  title          TEXT    NOT NULL,
  ordered        INTEGER NOT NULL,
  target         INTEGER NOT NULL DEFAULT 10,
  implied_clues  TEXT    NOT NULL DEFAULT '[]',
  status         TEXT    NOT NULL DEFAULT 'pending',  -- pending|live|complete|abandoned
  started_at_ms  INTEGER,
  ended_at_ms    INTEGER,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (room_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_game_round_instances_room ON game_round_instances (room_id, seq);

-- Fifty ranks are frozen, not ten.
--
-- Ranks 1..target are the board; 11..50 are the near-miss tail that lets a
-- guess just off the board be told how close it was ("16th, 54 goals"). That
-- feedback currently comes from rankOf(), which runs live SQL — unacceptable
-- mid-round. Fetching 50 costs essentially what 10 costs (these are
-- ORDER BY ... LIMIT queries; rankOf already asks for 200), so the whole
-- feature survives at no cost and with no I/O during play.
--
-- name_norm/surname_norm are precomputed so matching a guess is fifty string
-- comparisons in memory rather than a query.
CREATE TABLE IF NOT EXISTS game_round_answers (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id          INTEGER NOT NULL REFERENCES game_round_instances(id) ON DELETE CASCADE,
  rank                 INTEGER NOT NULL,
  on_board             INTEGER NOT NULL,
  footballer_id        INTEGER,
  name                 TEXT    NOT NULL,
  name_norm            TEXT    NOT NULL,
  surname_norm         TEXT    NOT NULL,
  nationality          TEXT,
  photo_url            TEXT,
  value                INTEGER NOT NULL,
  unit                 TEXT,
  clue_json            TEXT,
  found_at_ms          INTEGER,
  found_by_participant_id INTEGER REFERENCES game_participants(id) ON DELETE SET NULL,
  UNIQUE (instance_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_game_round_answers_instance ON game_round_answers (instance_id, on_board, rank);

-- Every guess, with the verdict the server gave it.
--
-- UNIQUE(instance_id, client_guess_id) is the whole retry story: a flaky
-- mobile network that submits the same guess twice must not score it twice.
-- The server replays the stored verdict instead.
CREATE TABLE IF NOT EXISTS game_guesses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id     INTEGER NOT NULL REFERENCES game_round_instances(id) ON DELETE CASCADE,
  participant_id  INTEGER NOT NULL REFERENCES game_participants(id) ON DELETE CASCADE,
  client_guess_id TEXT    NOT NULL,
  raw             TEXT    NOT NULL,
  raw_norm        TEXT    NOT NULL,
  verdict         TEXT    NOT NULL,   -- hit|near|duplicate|miss
  matched_rank    INTEGER,
  t_ms            INTEGER NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (instance_id, client_guess_id)
);

CREATE INDEX IF NOT EXISTS idx_game_guesses_instance ON game_guesses (instance_id, t_ms);

-- Names nobody recognised.
--
-- Solo play answers an unknown name by scraping Wikipedia live. A room must
-- never do that: it is an unbounded fetch while four people stare at a frozen
-- UI on camera, it mutates career_statistics for the whole product from inside
-- a game, and it invalidates the snapshot the recording depends on. Park the
-- raw text here instead and resolve it after the room ends, so a mid-game
-- liability becomes data collection for future rounds.
CREATE TABLE IF NOT EXISTS game_guess_reviews (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id            INTEGER NOT NULL REFERENCES game_round_instances(id) ON DELETE CASCADE,
  raw                    TEXT    NOT NULL,
  raw_norm               TEXT    NOT NULL,
  status                 TEXT    NOT NULL DEFAULT 'pending',  -- pending|resolved|rejected
  resolved_footballer_id INTEGER REFERENCES footballers(id) ON DELETE SET NULL,
  created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (instance_id, raw_norm)
);

CREATE INDEX IF NOT EXISTS idx_game_guess_reviews_status ON game_guess_reviews (status, created_at);
