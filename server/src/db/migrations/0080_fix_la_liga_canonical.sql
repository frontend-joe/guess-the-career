-- Repair league canonicalisation: "Primera División" was being folded into
-- "La Liga", but it's the name of the top flight in Argentina, Chile, Peru,
-- Colombia, Uruguay and others. That credited South American league goals to
-- Spain — e.g. Javier Zanetti, who never played in Spain, appeared in a
-- "Most La Liga goals" round with his Banfield seasons.
--
-- Reset any row whose canonical league says La Liga but whose verbatim division
-- isn't actually La Liga, so it keeps its own (honest, if ambiguous) league.
UPDATE career_statistics
SET league = division
WHERE league = 'La Liga'
  AND LOWER(REPLACE(division, ' ', '')) <> 'laliga';
