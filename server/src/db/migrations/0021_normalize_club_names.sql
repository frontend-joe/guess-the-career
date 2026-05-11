-- Normalize career_stints club names to match the canonical club aliases
UPDATE career_stints SET club = 'AC Milan' WHERE club IN ('Milan', 'A.C. Milan');
UPDATE career_stints SET club = 'Inter Milan' WHERE club IN ('Internazionale', 'FC Internazionale', 'FC Internazionale Milano');
UPDATE career_stints SET club = 'Real Zaragoza' WHERE club = 'Zaragoza';
UPDATE career_stints SET club = 'Real Betis' WHERE club = 'Betis';
UPDATE career_stints SET club = 'Mallorca' WHERE club = 'Real Mallorca';
UPDATE career_stints SET club = 'Oviedo' WHERE club = 'Real Oviedo';
UPDATE career_stints SET club = 'Monaco' WHERE club IN ('AS Monaco', 'AS Monaco FC');
UPDATE career_stints SET club = 'PSV' WHERE club = 'PSV Eindhoven';

-- Fix xi_players team names
UPDATE xi_players SET team = 'AC Milan' WHERE team IN ('Milan', 'A.C. Milan');
UPDATE xi_players SET team = 'Inter Milan' WHERE team IN ('Internazionale', 'FC Internazionale', 'FC Internazionale Milano');

-- Fix xi_matches team names
UPDATE xi_matches SET home_team = 'AC Milan' WHERE home_team IN ('Milan', 'A.C. Milan');
UPDATE xi_matches SET away_team = 'AC Milan' WHERE away_team IN ('Milan', 'A.C. Milan');
UPDATE xi_matches SET home_team = 'Inter Milan' WHERE home_team IN ('Internazionale', 'FC Internazionale', 'FC Internazionale Milano');
UPDATE xi_matches SET away_team = 'Inter Milan' WHERE away_team IN ('Internazionale', 'FC Internazionale', 'FC Internazionale Milano');

-- Fix xi_schedule team selections
UPDATE xi_schedule SET team = 'AC Milan' WHERE team IN ('Milan', 'A.C. Milan');
UPDATE xi_schedule SET team = 'Inter Milan' WHERE team IN ('Internazionale', 'FC Internazionale', 'FC Internazionale Milano');

-- Also fix the clubs table entries with un-normalized names
UPDATE clubs SET name = 'AC Milan' WHERE name IN ('Milan', 'A.C. Milan');
UPDATE clubs SET name = 'Inter Milan' WHERE name IN ('Internazionale', 'FC Internazionale', 'FC Internazionale Milano');
UPDATE clubs SET name = 'Real Zaragoza' WHERE name = 'Zaragoza';
UPDATE clubs SET name = 'Real Betis' WHERE name = 'Betis';
UPDATE clubs SET name = 'Mallorca' WHERE name = 'Real Mallorca';
UPDATE clubs SET name = 'Oviedo' WHERE name = 'Real Oviedo';
UPDATE clubs SET name = 'Monaco' WHERE name IN ('AS Monaco', 'AS Monaco FC');
UPDATE clubs SET name = 'PSV' WHERE name = 'PSV Eindhoven';
