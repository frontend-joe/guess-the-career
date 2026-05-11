UPDATE career_stints SET club = 'Dortmund' WHERE club = 'Borussia Dortmund';
UPDATE xi_players SET team = 'Dortmund' WHERE team = 'Borussia Dortmund';
UPDATE xi_matches SET home_team = 'Dortmund' WHERE home_team = 'Borussia Dortmund';
UPDATE xi_matches SET away_team = 'Dortmund' WHERE away_team = 'Borussia Dortmund';
UPDATE xi_schedule SET team = 'Dortmund' WHERE team = 'Borussia Dortmund';
UPDATE clubs SET name = 'Dortmund' WHERE name = 'Borussia Dortmund' AND NOT EXISTS (SELECT 1 FROM clubs c2 WHERE c2.name = 'Dortmund');
DELETE FROM clubs WHERE name = 'Borussia Dortmund';
