-- Strip Wikipedia citations from career_stints club names.
-- Loan clubs: "→ Club[2] (loan)" → "→ Club (loan)"
UPDATE career_stints
SET club = TRIM(SUBSTR(club, 1, INSTR(club, '[') - 1)) || ' (loan)'
WHERE INSTR(club, '[') > 0 AND club LIKE '→%';

-- Non-loan clubs: "Club[2]" → "Club"
UPDATE career_stints
SET club = TRIM(SUBSTR(club, 1, INSTR(club, '[') - 1))
WHERE INSTR(club, '[') > 0 AND club NOT LIKE '→%';

-- Strip Wikipedia citations from manager_career_stints club names.
UPDATE manager_career_stints
SET club = TRIM(SUBSTR(club, 1, INSTR(club, '[') - 1))
WHERE INSTR(club, '[') > 0;

-- Normalise Inter Milan aliases (non-loan)
UPDATE career_stints SET club = 'Inter Milan'
WHERE club IN ('Internazionale', 'FC Internazionale', 'FC Internazionale Milano');

-- Normalise Inter Milan aliases (loan)
UPDATE career_stints SET club = '→ Inter Milan (loan)'
WHERE club IN ('→ Internazionale (loan)', '→ FC Internazionale (loan)', '→ FC Internazionale Milano (loan)');

-- Normalise AC Milan aliases (non-loan)
UPDATE career_stints SET club = 'AC Milan'
WHERE club IN ('A.C. Milan', 'Milan');

-- Normalise AC Milan aliases (loan)
UPDATE career_stints SET club = '→ AC Milan (loan)'
WHERE club IN ('→ A.C. Milan (loan)', '→ Milan (loan)');

-- Normalise Real Zaragoza aliases (non-loan)
UPDATE career_stints SET club = 'Real Zaragoza'
WHERE club = 'Zaragoza';

-- Normalise Real Zaragoza aliases (loan)
UPDATE career_stints SET club = '→ Real Zaragoza (loan)'
WHERE club = '→ Zaragoza (loan)';

-- Normalise Real Betis aliases (non-loan)
UPDATE career_stints SET club = 'Real Betis'
WHERE club = 'Betis';

-- Normalise Real Betis aliases (loan)
UPDATE career_stints SET club = '→ Real Betis (loan)'
WHERE club = '→ Betis (loan)';

-- Rebuild clubs table from footballer senior careers only.
DELETE FROM clubs;

INSERT INTO clubs (name)
SELECT DISTINCT
  TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
FROM career_stints
WHERE stint_type = 'senior';

-- Drop manager career stints → clubs triggers (clubs sourced from footballer senior careers only).
DROP TRIGGER IF EXISTS clubs_from_manager_career_stints_insert;
DROP TRIGGER IF EXISTS clubs_from_manager_career_stints_update;
