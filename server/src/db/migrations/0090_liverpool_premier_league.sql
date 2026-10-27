-- Liverpool's seasons are labelled 'PL' where every other English top-flight
-- club says 'Premier League', and that quietly costs us answers.
--
-- Rounds that need a club's league resolve it through club_seasons, so a spell
-- at Liverpool landed in a league called 'PL' that no round ever asks for.
-- The visible symptom: Luis Suárez was missing from "Uruguay Premier League
-- players (most goals)" despite 69 goals for Liverpool, while Darwin Núñez
-- was present — Núñez has scraped season rows that say 'Premier League', and
-- Suárez only has career stints, which go through club_seasons.
--
-- 'PL' is NOT globally safe to rename: St Johnstone uses it for the Scottish
-- Premier League, which is a different competition. So this only touches
-- clubs that also played in the English league system, identified by a
-- 'First Division' / 'Premier League' / 'EFL Championship' row of their own.
-- St Johnstone's other labels are Scottish abbreviations (D1, FD, SP), so it
-- is correctly left alone.
--
-- The year guard is belt and braces: there was no Premier League before 1992.
--
-- This fixes one alias, not the problem. club_seasons holds over a thousand
-- distinct league labels, many of them mis-scraped ('1', '22', '–', 'Lge 1'),
-- and each one splits a competition into a bucket no round can see. That
-- wants its own pass.

UPDATE club_seasons
SET league = 'Premier League'
WHERE league = 'PL'
  AND season_year >= 1992
  AND club IN (
    SELECT club FROM club_seasons
    WHERE league IN ('First Division', 'Premier League', 'EFL Championship')
  );
