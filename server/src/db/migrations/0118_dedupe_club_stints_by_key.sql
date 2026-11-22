-- The same again, for the spellings no alias map knows about.
--
-- 0117 collapsed the rows that differed only by an entry in CLUB_ALIASES.
-- Neymar showed the next kind: "Al Hilal 2023–2025, 3 (0)" and "Al-Hilal
-- 2023–2025, 3 (0)", one hyphen apart, with nothing in the alias map to
-- connect them, so 0117 walked straight past it.
--
-- club_key() is the blunter comparison — the canonical name with its accents,
-- its case and all its punctuation removed — and the duplicate checks in the
-- routes now use it too, so this is a last sweep rather than a recurring one.
-- A survey of all 31,118 stint rows before writing this found exactly one
-- group left, Neymar's. It is written as a general sweep anyway, because the
-- next spelling nobody writes down will land here as well.
--
-- Same rules as 0117: the earliest row wins, since its sort_order is the real
-- career order, but it takes the later scrape's numbers where it has them;
-- and a loan and a permanent transfer over the same years stay two spells,
-- because club_key() strips the "→" and the "(loan)" along with the rest.

UPDATE career_stints AS k
SET
  apps = COALESCE((
    SELECT d.apps FROM career_stints d
     WHERE d.footballer_id = k.footballer_id AND d.years = k.years
       AND d.stint_type = k.stint_type
       AND club_key(d.club) = club_key(k.club)
       AND (d.club LIKE '→%') = (k.club LIKE '→%')
       AND d.id > k.id AND d.apps IS NOT NULL
     ORDER BY d.id DESC LIMIT 1), k.apps),
  goals = COALESCE((
    SELECT d.goals FROM career_stints d
     WHERE d.footballer_id = k.footballer_id AND d.years = k.years
       AND d.stint_type = k.stint_type
       AND club_key(d.club) = club_key(k.club)
       AND (d.club LIKE '→%') = (k.club LIKE '→%')
       AND d.id > k.id AND d.goals IS NOT NULL
     ORDER BY d.id DESC LIMIT 1), k.goals),
  club_wikipedia_url = COALESCE((
    SELECT d.club_wikipedia_url FROM career_stints d
     WHERE d.footballer_id = k.footballer_id AND d.years = k.years
       AND d.stint_type = k.stint_type
       AND club_key(d.club) = club_key(k.club)
       AND (d.club LIKE '→%') = (k.club LIKE '→%')
       AND d.id > k.id AND d.club_wikipedia_url IS NOT NULL
     ORDER BY d.id DESC LIMIT 1), k.club_wikipedia_url)
WHERE EXISTS (
  SELECT 1 FROM career_stints d
   WHERE d.footballer_id = k.footballer_id AND d.years = k.years
     AND d.stint_type = k.stint_type
     AND club_key(d.club) = club_key(k.club)
     AND (d.club LIKE '→%') = (k.club LIKE '→%')
     AND d.id > k.id);

DELETE FROM career_stints
 WHERE id IN (
   SELECT d.id FROM career_stints d
     JOIN career_stints k
       ON k.footballer_id = d.footballer_id
      AND k.years = d.years
      AND k.stint_type = d.stint_type
      AND club_key(k.club) = club_key(d.club)
      AND (k.club LIKE '→%') = (d.club LIKE '→%')
      AND k.id < d.id);
