-- Put back the space a line break ate.
--
-- Wikipedia breaks a long name across two lines with <br>, and cheerio's
-- .text() joins the halves with nothing at all. So "Tottenham<br>Hotspur"
-- was read as "TottenhamHotspur" and stored that way, and every club round
-- asking for Tottenham Hotspur quietly could not see those seasons: Niko
-- Kranjčar's 71 Spurs appearances were worth fifth place on a board that
-- told him he was not on the list. Divisions suffered the same way —
-- "UkrainianPremier League", "Major LeagueSoccer".
--
-- The scraper now turns every <br> into a space, which stops it happening
-- again. This repairs what is already here, and it does it by corroboration
-- rather than by guessing where a space belongs, because plenty of real
-- names look exactly like the damage: VfL Wolfsburg, AaB, MyPa, LigaPro,
-- and NorthEast United, who really are spelled that way.
--
-- A club row is only rewritten when the player's OWN infobox — a different
-- part of the same article, parsed separately — spells the same name with
-- spaces, and when the glued spelling appears nowhere in the infoboxes as a
-- name in its own right. That second condition is what saves NorthEast
-- United from being "corrected" into something it isn't.
--
-- A division is only rewritten when another row in the database already
-- holds the identical name with spaces in it. The comparison is
-- case-sensitive on purpose: Serbian SuperLiga and Serbian Superliga differ
-- by case, not by a missing space, and are none of this migration's
-- business.
--
-- Rows with no corroboration anywhere are left alone. They will come right
-- the next time that player is scraped.

UPDATE career_statistics AS cs
   SET club = CASE WHEN cs.club LIKE '% (loan)'
                   THEN fix.spaced || ' (loan)'
                   ELSE fix.spaced END
  FROM (
    SELECT DISTINCT cs2.id AS row_id, replace(s.club, '→ ', '') AS spaced
      FROM career_statistics cs2
      JOIN career_stints s ON s.footballer_id = cs2.footballer_id
     WHERE cs2.club GLOB '*[a-z][A-Z]*'
       AND replace(replace(s.club, '→ ', ''), ' ', '')
         = replace(replace(cs2.club, ' (loan)', ''), ' ', '')
       AND replace(s.club, '→ ', '') <> replace(cs2.club, ' (loan)', '')
       AND NOT EXISTS (
             SELECT 1 FROM career_stints k
              WHERE k.club = replace(cs2.club, ' (loan)', '')
           )
  ) AS fix
 WHERE cs.id = fix.row_id;

UPDATE career_statistics AS cs
   SET division = fix.spaced,
       league = CASE WHEN cs.league = cs.division THEN fix.spaced ELSE cs.league END
  FROM (
    SELECT DISTINCT cs2.id AS row_id, good.division AS spaced
      FROM career_statistics cs2
      JOIN (SELECT DISTINCT division FROM career_statistics WHERE division IS NOT NULL) AS good
        ON replace(good.division, ' ', '') = replace(cs2.division, ' ', '')
       AND good.division <> cs2.division
       AND length(good.division) > length(cs2.division)
     WHERE cs2.division GLOB '*[a-z][A-Z]*'
  ) AS fix
 WHERE cs.id = fix.row_id;
