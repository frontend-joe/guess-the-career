-- Remember that we looked, not just what we found.
--
-- Most clubs have no "List of <club> seasons" article — locally 909 of 1,113,
-- on production around 1,200 of 1,617. Those write no rows, so a resume that
-- skips "clubs already in club_seasons" doesn't skip them: every rerun fetches
-- all of them again. That turned a 980-club resume into a 1,463-club one.
--
-- A check is recorded per club with what it found, so a rerun can skip the
-- ones already known to have no article. `error` separates "we looked and
-- there's nothing there" from "the fetch failed" — a failure must stay
-- retryable, or one transient 429 would bury a club permanently.

CREATE TABLE IF NOT EXISTS club_season_checks (
  club          TEXT PRIMARY KEY,
  checked_at    TEXT NOT NULL DEFAULT (datetime('now')),
  seasons_found INTEGER NOT NULL DEFAULT 0,
  error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_club_season_checks_found
  ON club_season_checks (seasons_found, checked_at);
