-- Collapse the same spell at the same club, stored twice under two spellings.
--
-- Fernando Cáceres played for Celta once, from 1998 to 2004, and his card
-- listed it twice: "Celta 1998–2004, 198 (3)" and "Celta Vigo 1998–2004,
-- 198 (3)". Read as a career that is what 396 appearances looks like, and it
-- is why a six-year spell read as a twelve-year one.
--
-- Neither row is wrong. The scraper canonicalises a club name through
-- CLUB_ALIASES before it stores it, so his spell came in as "Celta" when it
-- was scraped and as "Celta Vigo" after "Celta" was added to the alias map.
-- Every top-up path then asks "do we already have this?" with
--
--   WHERE footballer_id = ? AND years = ? AND club = ?
--
-- which compares the raw strings, decides it has never seen this spell, and
-- appends it at the end of the career — after the international row, which
-- is why the stray appears below the national team on the card. Each alias
-- added to the map therefore seeded a fresh wave of these the next time the
-- players it covers were rescraped, and Celta, Deportivo and Inter Milan
-- were all added for exactly that reason.
--
-- The checks now compare normalize_club_alias(club), so it stops happening.
-- This clears what is already here.
--
-- Two spells only count as the same one when the player, the years, the
-- stint type and the canonical club all match, AND they agree about being a
-- loan: normalize_club_alias() strips the "→" and the "(loan)" suffix along
-- with the alias, so without that last condition a loan and a permanent
-- transfer covering the same years would be merged into one.
--
-- The earliest row wins, because its sort_order is the player's real career
-- order and the duplicate's is wherever the append happened to land. But it
-- takes the later scrape's numbers where it has them, since for anyone still
-- playing the newer row is the one with this season's appearances in it.

UPDATE career_stints AS k
SET
  apps = COALESCE((
    SELECT d.apps FROM career_stints d
     WHERE d.footballer_id = k.footballer_id AND d.years = k.years
       AND d.stint_type = k.stint_type
       AND normalize_club_alias(d.club) = normalize_club_alias(k.club)
       AND (d.club LIKE '→%') = (k.club LIKE '→%')
       AND d.id > k.id AND d.apps IS NOT NULL
     ORDER BY d.id DESC LIMIT 1), k.apps),
  goals = COALESCE((
    SELECT d.goals FROM career_stints d
     WHERE d.footballer_id = k.footballer_id AND d.years = k.years
       AND d.stint_type = k.stint_type
       AND normalize_club_alias(d.club) = normalize_club_alias(k.club)
       AND (d.club LIKE '→%') = (k.club LIKE '→%')
       AND d.id > k.id AND d.goals IS NOT NULL
     ORDER BY d.id DESC LIMIT 1), k.goals),
  club_wikipedia_url = COALESCE((
    SELECT d.club_wikipedia_url FROM career_stints d
     WHERE d.footballer_id = k.footballer_id AND d.years = k.years
       AND d.stint_type = k.stint_type
       AND normalize_club_alias(d.club) = normalize_club_alias(k.club)
       AND (d.club LIKE '→%') = (k.club LIKE '→%')
       AND d.id > k.id AND d.club_wikipedia_url IS NOT NULL
     ORDER BY d.id DESC LIMIT 1), k.club_wikipedia_url)
WHERE EXISTS (
  SELECT 1 FROM career_stints d
   WHERE d.footballer_id = k.footballer_id AND d.years = k.years
     AND d.stint_type = k.stint_type
     AND normalize_club_alias(d.club) = normalize_club_alias(k.club)
     AND (d.club LIKE '→%') = (k.club LIKE '→%')
     AND d.id > k.id);

DELETE FROM career_stints
 WHERE id IN (
   SELECT d.id FROM career_stints d
     JOIN career_stints k
       ON k.footballer_id = d.footballer_id
      AND k.years = d.years
      AND k.stint_type = d.stint_type
      AND normalize_club_alias(k.club) = normalize_club_alias(d.club)
      AND (k.club LIKE '→%') = (d.club LIKE '→%')
      AND k.id < d.id);
