-- 0080 stripped every "Primera División" row out of La Liga, which fixed the
-- South American false positives but also dropped genuinely Spanish rows —
-- some Spanish articles label the top flight "Primera División" rather than
-- "La Liga" (e.g. Oviedo, Valencia).
--
-- Decide by club, using the data we already have: a club counts as Spanish if
-- it ALSO appears with a La Liga division somewhere in the table. River Plate,
-- Boca Juniors, Colo-Colo and Alianza Lima never do; Valencia and Oviedo do.
UPDATE career_statistics
SET league = 'La Liga'
WHERE division = 'Primera División'
  AND REPLACE(club, ' (loan)', '') IN (
    SELECT DISTINCT REPLACE(club, ' (loan)', '')
    FROM career_statistics
    WHERE LOWER(REPLACE(division, ' ', '')) = 'laliga'
  );
