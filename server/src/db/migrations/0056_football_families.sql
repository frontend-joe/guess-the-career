-- Footballing Families detection: relatives found in each footballer's Wikipedia
-- bio. relative_footballer_id is set when the relative is already in our DB,
-- otherwise null (a candidate that would need scraping to include in the game).

CREATE TABLE IF NOT EXISTS football_family_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  footballer_id INTEGER NOT NULL,
  relative_name TEXT NOT NULL,
  relative_wikipedia_url TEXT NOT NULL,
  relationship TEXT,
  relative_footballer_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(footballer_id, relative_wikipedia_url)
);
