-- Consolidate "Atlético Madrid" (accented) into "Atletico Madrid" globally.
-- The clubs table had two rows (accented + plain); keep the richer accented
-- row's data but rename it to the plain canonical name, dropping the plain
-- duplicate. Every other table stores club names as plain text, so REPLACE the
-- accented substring wherever it appears — this also covers "Atlético Madrid B",
-- loan-arrow prefixes ("→ Atlético Madrid") and combined "A / B" values.

-- 1. clubs: drop the plain duplicate (only when the accented row also exists, so
--    we never delete the sole row), then rename the accented row. clubs.name is
--    UNIQUE, so the delete-before-rename order matters.
DELETE FROM clubs
 WHERE name = 'Atletico Madrid'
   AND EXISTS (SELECT 1 FROM clubs c2 WHERE c2.name = 'Atlético Madrid');
UPDATE clubs SET name = 'Atletico Madrid' WHERE name = 'Atlético Madrid';

-- 2. Content tables (no UNIQUE constraint on the club column — plain UPDATE).
UPDATE career_stints                 SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE manager_career_stints         SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE xi_matches                    SET home_team    = REPLACE(home_team, 'Atlético Madrid', 'Atletico Madrid')     WHERE home_team LIKE '%Atlético Madrid%';
UPDATE xi_matches                    SET away_team    = REPLACE(away_team, 'Atlético Madrid', 'Atletico Madrid')     WHERE away_team LIKE '%Atlético Madrid%';
UPDATE xi_players                    SET team         = REPLACE(team, 'Atlético Madrid', 'Atletico Madrid')          WHERE team LIKE '%Atlético Madrid%';
UPDATE xi_players                    SET club_at_time = REPLACE(club_at_time, 'Atlético Madrid', 'Atletico Madrid')  WHERE club_at_time LIKE '%Atlético Madrid%';
UPDATE xi_schedule                   SET team         = REPLACE(team, 'Atlético Madrid', 'Atletico Madrid')          WHERE team LIKE '%Atlético Madrid%';
UPDATE competition_top_scorers       SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE competition_hat_tricks        SET for_club     = REPLACE(for_club, 'Atlético Madrid', 'Atletico Madrid')      WHERE for_club LIKE '%Atlético Madrid%';
UPDATE competition_hat_tricks        SET against_club = REPLACE(against_club, 'Atlético Madrid', 'Atletico Madrid')  WHERE against_club LIKE '%Atlético Madrid%';
UPDATE competition_top_assists       SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE ballon_dor_players            SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE world_cup_squads              SET team         = REPLACE(team, 'Atlético Madrid', 'Atletico Madrid')          WHERE team LIKE '%Atlético Madrid%';
UPDATE world_cup_squad_players       SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE nationals_enabled_combos      SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE nationals_schedule            SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE club_legends_enabled_clubs    SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE club_legends_schedule         SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE club_marksman_enabled_clubs   SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE club_marksman_schedule        SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE club_foreigners_enabled_clubs SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE club_foreigners_schedule      SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE club_foreigners_home_override SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE record_signings_clubs         SET club         = REPLACE(club, 'Atlético Madrid', 'Atletico Madrid')          WHERE club LIKE '%Atlético Madrid%';
UPDATE record_signings_players       SET from_club    = REPLACE(from_club, 'Atlético Madrid', 'Atletico Madrid')     WHERE from_club LIKE '%Atlético Madrid%';
UPDATE transfer_window_players       SET from_club    = REPLACE(from_club, 'Atlético Madrid', 'Atletico Madrid')     WHERE from_club LIKE '%Atlético Madrid%';
UPDATE transfer_window_players       SET to_club      = REPLACE(to_club, 'Atlético Madrid', 'Atletico Madrid')       WHERE to_club LIKE '%Atlético Madrid%';

-- 3. Multi-club pair/trio/schedule config tables (OR IGNORE: a plain-named twin
--    pairing may already exist, and we'd rather skip than abort the migration).
UPDATE OR IGNORE two_clubs_enabled_pairs   SET club_a   = REPLACE(club_a, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_a LIKE '%Atlético Madrid%';
UPDATE OR IGNORE two_clubs_enabled_pairs   SET club_b   = REPLACE(club_b, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_b LIKE '%Atlético Madrid%';
UPDATE OR IGNORE two_clubs_schedule        SET club_a   = REPLACE(club_a, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_a LIKE '%Atlético Madrid%';
UPDATE OR IGNORE two_clubs_schedule        SET club_b   = REPLACE(club_b, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_b LIKE '%Atlético Madrid%';
UPDATE OR IGNORE three_clubs_enabled_trios SET club_a   = REPLACE(club_a, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_a LIKE '%Atlético Madrid%';
UPDATE OR IGNORE three_clubs_enabled_trios SET club_b   = REPLACE(club_b, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_b LIKE '%Atlético Madrid%';
UPDATE OR IGNORE three_clubs_enabled_trios SET club_c   = REPLACE(club_c, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_c LIKE '%Atlético Madrid%';
UPDATE OR IGNORE three_clubs_schedule      SET club_a   = REPLACE(club_a, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_a LIKE '%Atlético Madrid%';
UPDATE OR IGNORE three_clubs_schedule      SET club_b   = REPLACE(club_b, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_b LIKE '%Atlético Madrid%';
UPDATE OR IGNORE three_clubs_schedule      SET club_c   = REPLACE(club_c, 'Atlético Madrid', 'Atletico Madrid')      WHERE club_c LIKE '%Atlético Madrid%';
UPDATE OR IGNORE transfers_enabled_pairs   SET from_club = REPLACE(from_club, 'Atlético Madrid', 'Atletico Madrid')  WHERE from_club LIKE '%Atlético Madrid%';
UPDATE OR IGNORE transfers_enabled_pairs   SET to_club   = REPLACE(to_club, 'Atlético Madrid', 'Atletico Madrid')    WHERE to_club LIKE '%Atlético Madrid%';
UPDATE OR IGNORE transfers_schedule        SET from_club = REPLACE(from_club, 'Atlético Madrid', 'Atletico Madrid')  WHERE from_club LIKE '%Atlético Madrid%';
UPDATE OR IGNORE transfers_schedule        SET to_club   = REPLACE(to_club, 'Atlético Madrid', 'Atletico Madrid')    WHERE to_club LIKE '%Atlético Madrid%';
