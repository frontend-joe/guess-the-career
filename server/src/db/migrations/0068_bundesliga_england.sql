-- Force England into the Bundesliga game with a 3-guess target, even though no
-- English players who played in Germany have been scraped in yet — they get
-- added via auto-scrape as players guess them. Also schedule it as a round.
INSERT OR IGNORE INTO bundesliga_enabled_countries (nationality, round_size) VALUES ('England', 3);
INSERT OR IGNORE INTO bundesliga_schedule (date, nationality) VALUES (date('now'), 'England');
