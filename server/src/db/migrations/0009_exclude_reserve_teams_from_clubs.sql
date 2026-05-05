-- Remove reserve/B/C team entries from the clubs lookup table.
-- career_stints data is intentionally left untouched — full career history is kept.
-- Games filter these out at query time.
DELETE FROM clubs
WHERE name LIKE '% B'
   OR name LIKE '% C'
   OR name = 'Bilbao Athletic';

-- Update insert trigger to skip reserve teams
DROP TRIGGER IF EXISTS clubs_from_career_stints_insert;
CREATE TRIGGER clubs_from_career_stints_insert
AFTER INSERT ON career_stints
WHEN NEW.stint_type = 'senior'
  AND TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% B'
  AND TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% C'
  AND TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')) != 'Bilbao Athletic'
BEGIN
  INSERT OR IGNORE INTO clubs (name, wikipedia_url)
    VALUES (
      TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')),
      NEW.club_wikipedia_url
    );
  UPDATE clubs
  SET wikipedia_url = NEW.club_wikipedia_url
  WHERE name = TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
    AND wikipedia_url IS NULL
    AND NEW.club_wikipedia_url IS NOT NULL;
END;

-- Update update trigger to skip reserve teams
DROP TRIGGER IF EXISTS clubs_from_career_stints_update;
CREATE TRIGGER clubs_from_career_stints_update
AFTER UPDATE OF club ON career_stints
WHEN NEW.stint_type = 'senior'
  AND TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% B'
  AND TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% C'
  AND TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')) != 'Bilbao Athletic'
BEGIN
  INSERT OR IGNORE INTO clubs (name, wikipedia_url)
    VALUES (
      TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')),
      NEW.club_wikipedia_url
    );
  UPDATE clubs
  SET wikipedia_url = NEW.club_wikipedia_url
  WHERE name = TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
    AND wikipedia_url IS NULL
    AND NEW.club_wikipedia_url IS NOT NULL;
END;
