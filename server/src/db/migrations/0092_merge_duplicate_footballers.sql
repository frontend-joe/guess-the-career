-- Remove footballers scraped twice.
--
-- Guessing "Raul" created a SECOND Raúl González. The resolver checks whether
-- a player exists by the text that was typed, so "Raul" found nothing, the
-- scrape went ahead, and the board then showed Raúl González at rank 1 and
-- rank 2 — same player, same 741 appearances, one found and one not.
--
-- THE DANGEROUS WAY TO FIX THIS is to delete footballers sharing a name. This
-- database has real homonyms and has been bitten by them repeatedly: two
-- Marcelos, two Zanettis, two Taylors. It also has two Michael Johnsons, born
-- 1973 and 1988, who are different people with different careers. Deduping by
-- name would quietly delete one of them.
--
-- So identity here is the NAME TOGETHER WITH THE DATE OF BIRTH. The Michael
-- Johnsons were born in 1973 and 1988, so they survive; two rows for one man
-- born on one day do not.
--
-- Not the Wikipedia URL, which looked airtight and is useless here: the column
-- is UNIQUE, so two rows can never share one. The duplicate exists precisely
-- BECAUSE the articles differ — "Raúl" and "Raúl González Blanco" are two
-- doors into the same player.
--
-- The survivor is whichever row carries more career statistics — a duplicate
-- is often the better-scraped one — and the lowest id breaks a tie, so the
-- original wins when both are equal.

CREATE TEMP TABLE _identity AS
SELECT
  f.id,
  lower(f.name) || '|' || f.born AS k,
  (SELECT COUNT(*) FROM career_statistics c WHERE c.footballer_id = f.id) AS stats
FROM footballers f
WHERE f.born IS NOT NULL AND f.born <> '';

CREATE TEMP TABLE _survivor AS
SELECT k, id FROM (
  SELECT k, id, ROW_NUMBER() OVER (PARTITION BY k ORDER BY stats DESC, id ASC) AS rn
  FROM _identity
) WHERE rn = 1;

CREATE TEMP TABLE _doomed AS
SELECT i.id FROM _identity i
JOIN _survivor s ON s.k = i.k
WHERE i.id <> s.id;

DELETE FROM career_statistics WHERE footballer_id IN (SELECT id FROM _doomed);
DELETE FROM footballers WHERE id IN (SELECT id FROM _doomed);

DROP TABLE _doomed;
DROP TABLE _survivor;
DROP TABLE _identity;
