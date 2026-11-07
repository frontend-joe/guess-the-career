-- Some "List of <club> seasons" pages write the tier beside the competition
-- as a Roman numeral — "La Liga (I)", "Bundesliga (I)" — and the scraper only
-- ever stripped the Arabic form, "La Liga (1)". So the decorated string went
-- into club_seasons.league untouched, matched no canonical name, and matched
-- nothing in ALLOWED_LEAGUES either.
--
-- club_seasons is what resolves a league for a player whose own career
-- statistics carry none, which is most players scraped from an infobox. The
-- cost was quiet and total: Amedeo Carboni played 245 La Liga games for
-- Valencia across nine seasons and was not an answer to "Italy La Liga
-- players (most appearances)", because every Valencia season on file said
-- "La Liga (I)". Valencia and VfL Bochum are the two clubs affected.
--
-- The scraper now strips both forms, but these rows are only rewritten when
-- the club is next scraped, which may be never. Correcting them here.
--
-- Deliberately only the four leagues whose names belong to one country.
-- Stripping the tier off every row would also rewrite Brann's "First
-- Division (VI)" — the sixth tier of Norwegian football — to "First
-- Division", which is what England's second tier is called in
-- ALLOWED_LEAGUES, and put Brann's players in English rounds. The scraper
-- has its own guard against that collision; this statement avoids it by
-- never touching a name England uses.
UPDATE club_seasons
   SET league = TRIM(SUBSTR(league, 1, INSTR(league, ' (') - 1))
 WHERE league LIKE '% (%)'
   AND TRIM(SUBSTR(league, 1, INSTR(league, ' (') - 1))
       IN ('Serie A', 'La Liga', 'Bundesliga', 'Ligue 1')
   AND SUBSTR(league, INSTR(league, ' (') + 2, LENGTH(league) - INSTR(league, ' (') - 2)
       IN ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII');
