-- "First Division" is two different English competitions, plus several foreign
-- ones that share the name. Resolve country by club, then era by season:
--
--   * Belgium (Anderlecht, Standard Liège, Mechelen, Charleroi), Scotland
--     (Motherwell), Cyprus (Anorthosis) and Ireland (Longford) all had a First
--     Division. A club is English only if it also appears under a division no
--     other country uses — that test separates cleanly here (every foreign club
--     scores 0, the lowest English club 8).
--   * Until 1991-92 the First Division was England's top flight.
--   * From 1992-93, once the Premier League broke away, it was the second tier
--     until it was renamed the Championship in 2004-05 — so those seasons are
--     the Championship under its old name and fold into it.
--
-- Everything the two tests can't place — foreign clubs, and the handful of
-- stray post-2004 rows — is marked unresolved by the second statement. It has
-- to be renamed rather than left alone: canonicalLeague passes an unrecognised
-- division straight through, so those rows already read league = 'First
-- Division' and would otherwise be counted as the English top flight.

WITH english AS (
  SELECT DISTINCT REPLACE(club, ' (loan)', '') AS club
  FROM career_statistics
  WHERE division IN ('Premier League', 'Championship', 'Second Division',
                     'Third Division', 'Fourth Division', 'League One', 'League Two')
)
UPDATE career_statistics
SET league = CASE
  WHEN CAST(SUBSTR(season, 1, 4) AS INTEGER) <= 1991 THEN 'First Division'
  ELSE 'EFL Championship'
END
WHERE division = 'First Division'
  AND season GLOB '[0-9][0-9][0-9][0-9]*'
  AND CAST(SUBSTR(season, 1, 4) AS INTEGER) <= 2003
  AND REPLACE(club, ' (loan)', '') IN (SELECT club FROM english);

WITH english AS (
  SELECT DISTINCT REPLACE(club, ' (loan)', '') AS club
  FROM career_statistics
  WHERE division IN ('Premier League', 'Championship', 'Second Division',
                     'Third Division', 'Fourth Division', 'League One', 'League Two')
)
UPDATE career_statistics
SET league = 'First Division (unresolved)'
WHERE division = 'First Division'
  AND league = 'First Division'
  AND (
    season NOT GLOB '[0-9][0-9][0-9][0-9]*'
    OR CAST(SUBSTR(season, 1, 4) AS INTEGER) > 1991
    OR REPLACE(club, ' (loan)', '') NOT IN (SELECT club FROM english)
  );
