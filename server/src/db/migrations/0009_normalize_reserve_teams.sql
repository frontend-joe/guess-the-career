-- Strip B/C team suffixes from career_stints club names.
-- Non-loan: "Barcelona B" → "Barcelona", "Barcelona C" → "Barcelona"
UPDATE career_stints
SET club = TRIM(SUBSTR(club, 1, LENGTH(club) - 2))
WHERE (club LIKE '% B' OR club LIKE '% C')
  AND club NOT LIKE '→%';

-- Loan: "→ Barcelona B (loan)" → "→ Barcelona (loan)"
UPDATE career_stints
SET club = REPLACE(club, ' B (loan)', ' (loan)')
WHERE club LIKE '→% B (loan)';

UPDATE career_stints
SET club = REPLACE(club, ' C (loan)', ' (loan)')
WHERE club LIKE '→% C (loan)';

-- Bilbao Athletic → Athletic Bilbao (non-loan)
UPDATE career_stints SET club = 'Athletic Bilbao'
WHERE club = 'Bilbao Athletic';

-- Bilbao Athletic → Athletic Bilbao (loan)
UPDATE career_stints SET club = '→ Athletic Bilbao (loan)'
WHERE club = '→ Bilbao Athletic (loan)';

-- Rebuild clubs table from normalised senior career stints.
DELETE FROM clubs;

INSERT INTO clubs (name, wikipedia_url)
SELECT
  TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) AS norm_name,
  MIN(club_wikipedia_url) AS wiki_url
FROM career_stints
WHERE stint_type = 'senior'
GROUP BY LOWER(TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')))
ON CONFLICT(name) DO UPDATE SET wikipedia_url = COALESCE(excluded.wikipedia_url, clubs.wikipedia_url);
