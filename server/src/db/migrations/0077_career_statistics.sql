-- Per-player, per-club-season league breakdown scraped from the Wikipedia
-- "Career statistics" table. Additive: career_stints (infobox club totals) is
-- unchanged. This table powers league-based games (e.g. goals/apps in a league).
CREATE TABLE IF NOT EXISTS career_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  footballer_id INTEGER NOT NULL REFERENCES footballers(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  club TEXT NOT NULL,
  club_wikipedia_url TEXT,
  season TEXT NOT NULL,
  division TEXT,            -- the league name as on Wikipedia (e.g. "Premier League", "Serie A")
  league TEXT,              -- canonical league key derived from division (pass-through if unknown)
  league_apps INTEGER,
  league_goals INTEGER,
  total_apps INTEGER,
  total_goals INTEGER
);

CREATE INDEX IF NOT EXISTS idx_career_stats_footballer ON career_statistics(footballer_id);
CREATE INDEX IF NOT EXISTS idx_career_stats_division ON career_statistics(division);
CREATE INDEX IF NOT EXISTS idx_career_stats_league ON career_statistics(league);
