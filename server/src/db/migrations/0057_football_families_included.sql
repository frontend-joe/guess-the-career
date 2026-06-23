-- Footballing Families: per-relationship validation flag. Checked (included = 1)
-- relationships are the ones used in the game.
ALTER TABLE football_family_links ADD COLUMN included INTEGER NOT NULL DEFAULT 0;
