-- Per-club round size for Club Foreigners (how many overseas players to guess),
-- default 5.
ALTER TABLE club_foreigners_enabled_clubs ADD COLUMN round_size INTEGER NOT NULL DEFAULT 5;
