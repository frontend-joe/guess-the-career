-- Manual override for a club's "home" country (the nationality excluded as
-- non-foreign) when the auto-detected most-common nationality is wrong.
CREATE TABLE IF NOT EXISTS club_foreigners_home_override (
  club TEXT PRIMARY KEY,
  home_country TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
