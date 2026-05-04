-- Clubs lookup table for autocomplete (normalised club names, no loan notation)
CREATE TABLE IF NOT EXISTS clubs (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Seed from career_stints (senior only — exclude international/national teams), stripping loan notation
INSERT OR IGNORE INTO clubs (name)
SELECT DISTINCT
  TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
FROM career_stints
WHERE stint_type = 'senior';

-- Seed from manager_career_stints
INSERT OR IGNORE INTO clubs (name)
SELECT DISTINCT
  TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
FROM manager_career_stints;

-- Trigger: career_stints insert (senior only)
CREATE TRIGGER IF NOT EXISTS clubs_from_career_stints_insert
AFTER INSERT ON career_stints
WHEN NEW.stint_type = 'senior'
BEGIN
  INSERT OR IGNORE INTO clubs (name)
    VALUES (TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')));
END;

-- Trigger: career_stints club update (senior only)
CREATE TRIGGER IF NOT EXISTS clubs_from_career_stints_update
AFTER UPDATE OF club ON career_stints
WHEN NEW.stint_type = 'senior'
BEGIN
  INSERT OR IGNORE INTO clubs (name)
    VALUES (TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')));
END;

-- Trigger: manager_career_stints insert
CREATE TRIGGER IF NOT EXISTS clubs_from_manager_career_stints_insert
AFTER INSERT ON manager_career_stints
BEGIN
  INSERT OR IGNORE INTO clubs (name)
    VALUES (TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')));
END;

-- Trigger: manager_career_stints club update
CREATE TRIGGER IF NOT EXISTS clubs_from_manager_career_stints_update
AFTER UPDATE OF club ON manager_career_stints
BEGIN
  INSERT OR IGNORE INTO clubs (name)
    VALUES (TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')));
END;
