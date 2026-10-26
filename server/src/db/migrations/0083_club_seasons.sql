-- Which division each club played in each season, scraped from the Wikipedia
-- "List of <club> seasons" pages.
--
-- Why: a player's infobox gives apps and goals per club spell but never says
-- which league they were in, so 1,943 spells (116,906 appearances across 468
-- players) can't be credited to a league today. We currently infer a club's
-- division per season from OTHER players' career statistics, which is full of
-- holes. These pages state it outright, back to the 1800s.
--
-- `league` is NEVER null: it holds the canonical name for the leagues we build
-- rounds from and the raw division text otherwise. That matters because the
-- consumer credits a spell to a league only when every season it spans was the
-- same one — if the seasons we don't care about were missing instead of named,
-- a spell straddling a relegation would look unanimous and be miscredited.

CREATE TABLE IF NOT EXISTS club_seasons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  club          TEXT    NOT NULL,
  season        TEXT    NOT NULL,
  season_year   INTEGER NOT NULL,
  division_raw  TEXT    NOT NULL,
  league        TEXT    NOT NULL,
  source_url    TEXT,
  scraped_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (club, season)
);

CREATE INDEX IF NOT EXISTS idx_club_seasons_club_year ON club_seasons (club, season_year);
CREATE INDEX IF NOT EXISTS idx_club_seasons_league    ON club_seasons (league);
