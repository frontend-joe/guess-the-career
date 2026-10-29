-- Geography Tenable — rounds whose answers are typed in rather than derived.
--
-- Football rounds are a query: ask the database for the top ten and it answers,
-- and the answer improves as the scraped data does. There is no equivalent for
-- the ten longest rivers. So a geography round IS its answer list, authored in
-- the admin section and stored here, and that list is the only authority on it.
--
-- Rounds are keyed by SLUG rather than by id, because the registry row in
-- tenable_rounds has to point at this round from inside its params JSON, and a
-- slug can be written by hand (in a seed, in a test) where an autoincrement id
-- cannot.
CREATE TABLE IF NOT EXISTS geography_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL,              -- 'countries' | 'cities' | 'rivers' | ...
  title TEXT NOT NULL,
  -- An ORDERED round is a ranked ten, each answer revealing at its own rank:
  -- the ten longest rivers. An UNORDERED round is "name any ten of these",
  -- with a pool bigger than the board: the countries beginning with S. Which
  -- one a round is is a property of the round, not of its topic — the same
  -- topic does both.
  ordered INTEGER NOT NULL DEFAULT 1,
  -- What the numbers are, for the tooltip on the board badge: 'km', 'm', 'km²',
  -- 'people'. NULL on an unordered round, where the numbers say nothing.
  unit TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS geography_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_slug TEXT NOT NULL REFERENCES geography_rounds(slug) ON DELETE CASCADE,
  position INTEGER NOT NULL,        -- rank on an ordered round; just an order otherwise
  name TEXT NOT NULL,
  -- Other names the same answer goes by, as a JSON array: ["USA", "America"].
  -- Spelling tolerance is handled by the matcher; this is for answers that are
  -- genuinely called something else, which no amount of edit distance reaches.
  aliases TEXT,
  value REAL NOT NULL DEFAULT 0,    -- orders the board
  -- How the value should READ on the badge: "6,650", "17.1m". Authored rather
  -- than formatted, because one rule cannot serve river kilometres and country
  -- populations at once, and the badge is thirty pixels wide.
  display TEXT,
  UNIQUE(round_slug, position)
);

CREATE INDEX IF NOT EXISTS idx_geography_rounds_topic ON geography_rounds(topic);
CREATE INDEX IF NOT EXISTS idx_geography_answers_round ON geography_answers(round_slug, position);
