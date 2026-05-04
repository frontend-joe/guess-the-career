-- Strip Wikipedia inline CSS markup from club names.
-- Pattern: " (.mw-parser-output ...)" appended to the real club name.
UPDATE career_stints
SET club = TRIM(SUBSTR(club, 1, INSTR(club, ' (.mw-parser-output') - 1))
WHERE INSTR(club, ' (.mw-parser-output') > 0;

UPDATE manager_career_stints
SET club = TRIM(SUBSTR(club, 1, INSTR(club, ' (.mw-parser-output') - 1))
WHERE INSTR(club, ' (.mw-parser-output') > 0;

-- For the clubs lookup table: the clean name likely already exists, so just delete the dirty entry.
DELETE FROM clubs WHERE INSTR(name, ' (.mw-parser-output') > 0;
