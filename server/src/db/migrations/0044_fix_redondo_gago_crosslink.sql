-- Fernando Redondo's record was cross-linked to Fernando Gago: a past rescrape
-- set his wikipedia_url to Gago's Wikipedia page and appended Gago's senior
-- stints onto Redondo's record (Boca Juniors, Real Madrid 2007–2012, Roma,
-- Valencia, Vélez Sársfield, etc.).
--
-- Redondo's real career ended at AC Milan (2000–2004); every stint starting in
-- 2004 or later on his record actually belongs to Gago. Remove those, then
-- restore the correct Wikipedia URL so Gago's page is free to import.
--
-- Keyed on the corrupt signature (name + wrong URL) so it is a no-op anywhere
-- the data is already correct. After deploying, re-verify "Fernando Gago" in
-- the admin UI to import him fresh.

DELETE FROM career_stints
WHERE footballer_id IN (
  SELECT id FROM footballers
  WHERE name = 'Fernando Redondo'
    AND wikipedia_url = 'https://en.wikipedia.org/wiki/Fernando_Gago'
)
AND CAST(substr(years, 1, 4) AS INTEGER) >= 2004;

UPDATE footballers
SET wikipedia_url = 'https://en.wikipedia.org/wiki/Fernando_Redondo'
WHERE name = 'Fernando Redondo'
  AND wikipedia_url = 'https://en.wikipedia.org/wiki/Fernando_Gago';
