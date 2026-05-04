-- Remove national team entries that were incorrectly seeded from international career stints.
-- Keep a club if it also appears in senior or managerial stints.
DELETE FROM clubs
WHERE name IN (
  SELECT DISTINCT TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
  FROM career_stints
  WHERE stint_type = 'international'
)
AND name NOT IN (
  SELECT DISTINCT TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
  FROM career_stints
  WHERE stint_type = 'senior'
)
AND name NOT IN (
  SELECT DISTINCT TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
  FROM manager_career_stints
);

-- Recreate the career_stints triggers with a WHEN clause so only senior stints add to clubs
DROP TRIGGER IF EXISTS clubs_from_career_stints_insert;
CREATE TRIGGER clubs_from_career_stints_insert
AFTER INSERT ON career_stints
WHEN NEW.stint_type = 'senior'
BEGIN
  INSERT OR IGNORE INTO clubs (name)
    VALUES (TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')));
END;

DROP TRIGGER IF EXISTS clubs_from_career_stints_update;
CREATE TRIGGER clubs_from_career_stints_update
AFTER UPDATE OF club ON career_stints
WHEN NEW.stint_type = 'senior'
BEGIN
  INSERT OR IGNORE INTO clubs (name)
    VALUES (TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')));
END;
