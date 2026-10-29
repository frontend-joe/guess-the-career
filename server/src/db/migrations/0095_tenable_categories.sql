-- Tenable becomes more than one game.
--
-- Football Tenable derives its rounds from the footballer database; a Geography
-- round cannot be derived from anything, so its answers are typed in and stored
-- (see 0096). What the two share is the whole machinery around a round: the
-- selected-rounds registry, the frozen multiplayer snapshot, the guess matching,
-- the board. So rather than fork any of that, a round gains a CATEGORY, and
-- every list that used to mean "all Tenable rounds" now asks for one
-- category's.
--
-- 'football' is the default so every round already selected keeps working
-- without being touched.
--
-- The daily schedule is deliberately NOT given a category. It belongs to the
-- solo web game, which is Football only; the new categories exist for the
-- multiplayer game, where the host picks a round from the pool rather than
-- being handed the day's.
ALTER TABLE tenable_rounds ADD COLUMN category TEXT NOT NULL DEFAULT 'football';
CREATE INDEX IF NOT EXISTS idx_tenable_rounds_category ON tenable_rounds(category);
