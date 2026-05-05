-- Add Wikipedia URL columns for club logo fetching
ALTER TABLE career_stints ADD COLUMN club_wikipedia_url TEXT;
ALTER TABLE clubs ADD COLUMN wikipedia_url TEXT;

-- Update career_stints insert trigger to also populate club wikipedia_url in clubs table
DROP TRIGGER IF EXISTS clubs_from_career_stints_insert;
CREATE TRIGGER clubs_from_career_stints_insert
AFTER INSERT ON career_stints
WHEN NEW.stint_type = 'senior'
BEGIN
  INSERT OR IGNORE INTO clubs (name, wikipedia_url)
    VALUES (
      TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', '')),
      NEW.club_wikipedia_url
    );
  -- Back-fill wikipedia_url if the club already exists but has no URL yet
  UPDATE clubs
  SET wikipedia_url = NEW.club_wikipedia_url
  WHERE name = TRIM(REPLACE(REPLACE(REPLACE(NEW.club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
    AND wikipedia_url IS NULL
    AND NEW.club_wikipedia_url IS NOT NULL;
END;

-- Update career_stints update trigger similarly
DROP TRIGGER IF EXISTS clubs_from_career_stints_update;
CREATE TRIGGER clubs_from_career_stints_update
AFTER UPDATE OF club ON career_stints
WHEN NEW.stint_type = 'senior'
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
