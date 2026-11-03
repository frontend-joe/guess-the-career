-- Five rounds about club names rather than players.
--
-- These could not be derived, which is why they are authored. The footballer
-- database knows which clubs a player turned out for; it does not know that
-- Plymouth Argyle is in England, that Argyle is the interesting half of the
-- name, or that Barnsley are the Tykes. So they live here with the rivers and
-- the biscuits, under topic 'football'.
--
-- All five are UNORDERED, which is what the subject is. There is no ranking of
-- the clubs beginning with S, so they carry no unit either — an unordered
-- board's numbers say nothing — and the pool is deliberately bigger than the
-- ten slots.
--
-- Two things about the aliases, both learned from how the matcher works:
--
--  1. A guess has to BE the answer — "York" is not New York, and by the same
--     rule "Aston Villa" is not Villa. So the endings round aliases every club
--     whose name ends in the word, because nobody shouts "Argyle" on its own.
--     The nicknames round deliberately does the opposite and aliases NOTHING:
--     if "Arsenal" counted as The Gunners the round would just be "name ten
--     clubs".
--
--  2. placeKey() strips a handful of noise words, and 'city' is one of them,
--     which a club round gets the benefit of: "Stoke City" and "Stoke" are the
--     same answer for free, and so are Swansea and Salford.
--
-- Every club named in these lists is one the clubs table actually holds, and
-- spelled the way it holds it — checked against all 3,274 of them rather than
-- typed from memory, because a club we have never heard of is an answer nobody
-- can be credited for.


-- ── Name 10 English league clubs beginning with S
-- "League" rather than "English" so Swansea belongs without an asterisk: they
-- are a Welsh club and an English league one, and somebody is going to say it.
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('clubs-english-s', 'football', 'Name 10 English league clubs beginning with S', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('clubs-english-s', 1, 'Southampton', NULL, 0, NULL),
  ('clubs-english-s', 2, 'Sunderland', NULL, 0, NULL),
  ('clubs-english-s', 3, 'Sheffield United', '["Sheffield Utd", "Blades"]', 0, NULL),
  ('clubs-english-s', 4, 'Sheffield Wednesday', '["Owls"]', 0, NULL),
  ('clubs-english-s', 5, 'Stoke City', NULL, 0, NULL),
  ('clubs-english-s', 6, 'Swansea City', NULL, 0, NULL),
  ('clubs-english-s', 7, 'Swindon Town', '["Swindon"]', 0, NULL),
  ('clubs-english-s', 8, 'Southend United', '["Southend"]', 0, NULL),
  ('clubs-english-s', 9, 'Stevenage', NULL, 0, NULL),
  ('clubs-english-s', 10, 'Shrewsbury Town', '["Shrewsbury"]', 0, NULL),
  ('clubs-english-s', 11, 'Stockport County', '["Stockport"]', 0, NULL),
  ('clubs-english-s', 12, 'Salford City', NULL, 0, NULL),
  ('clubs-english-s', 13, 'Scunthorpe United', '["Scunthorpe"]', 0, NULL),
  ('clubs-english-s', 14, 'Sutton United', '["Sutton"]', 0, NULL),
  ('clubs-english-s', 15, 'Southport', NULL, 0, NULL);

-- ── Name 10 English club name endings other than City, United or Town
-- The three excluded are excluded because they are most of the Football League
-- and the round would be over in ten seconds.
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('club-name-endings', 'football',
        'Name 10 English club name endings other than City, United or Town', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('club-name-endings', 1, 'Villa', '["Aston Villa"]', 0, NULL),
  ('club-name-endings', 2, 'Argyle', '["Plymouth Argyle"]', 0, NULL),
  ('club-name-endings', 3, 'Wanderers', '["Bolton Wanderers", "Wolverhampton Wanderers", "Wycombe Wanderers"]', 0, NULL),
  ('club-name-endings', 4, 'Albion', '["West Bromwich Albion", "Brighton and Hove Albion", "Burton Albion"]', 0, NULL),
  ('club-name-endings', 5, 'Rovers', '["Blackburn Rovers", "Bristol Rovers", "Doncaster Rovers", "Tranmere Rovers"]', 0, NULL),
  ('club-name-endings', 6, 'Hotspur', '["Tottenham Hotspur"]', 0, NULL),
  ('club-name-endings', 7, 'Athletic', '["Charlton Athletic", "Oldham Athletic", "Wigan Athletic"]', 0, NULL),
  ('club-name-endings', 8, 'Orient', '["Leyton Orient"]', 0, NULL),
  ('club-name-endings', 9, 'County', '["Derby County", "Notts County", "Newport County"]', 0, NULL),
  ('club-name-endings', 10, 'Alexandra', '["Crewe Alexandra"]', 0, NULL),
  ('club-name-endings', 11, 'Vale', '["Port Vale"]', 0, NULL),
  ('club-name-endings', 12, 'Forest', '["Nottingham Forest"]', 0, NULL),
  ('club-name-endings', 13, 'Palace', '["Crystal Palace"]', 0, NULL),
  ('club-name-endings', 14, 'Rangers', '["Queens Park Rangers", "QPR"]', 0, NULL),
  ('club-name-endings', 15, 'Wednesday', '["Sheffield Wednesday"]', 0, NULL),
  ('club-name-endings', 16, 'North End', '["Preston North End"]', 0, NULL),
  ('club-name-endings', 17, 'Stanley', '["Accrington Stanley"]', 0, NULL),
  ('club-name-endings', 18, 'Harriers', '["Kidderminster Harriers"]', 0, NULL),
  ('club-name-endings', 19, 'Trinity', '["Gainsborough Trinity"]', 0, NULL),
  ('club-name-endings', 20, 'Dons', '["AFC Wimbledon", "MK Dons", "Milton Keynes Dons"]', 0, NULL);

-- ── Name 10 English club nicknames
-- No club names aliased in, deliberately. See the note at the top.
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('club-nicknames', 'football', 'Name 10 English club nicknames', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('club-nicknames', 1, 'The Gunners', NULL, 0, NULL),
  ('club-nicknames', 2, 'The Toffees', NULL, 0, NULL),
  ('club-nicknames', 3, 'The Hammers', NULL, 0, NULL),
  ('club-nicknames', 4, 'The Magpies', NULL, 0, NULL),
  ('club-nicknames', 5, 'The Blades', NULL, 0, NULL),
  ('club-nicknames', 6, 'The Owls', NULL, 0, NULL),
  ('club-nicknames', 7, 'The Potters', NULL, 0, NULL),
  ('club-nicknames', 8, 'The Baggies', NULL, 0, NULL),
  ('club-nicknames', 9, 'The Cherries', NULL, 0, NULL),
  ('club-nicknames', 10, 'The Seagulls', NULL, 0, NULL),
  ('club-nicknames', 11, 'The Foxes', NULL, 0, NULL),
  ('club-nicknames', 12, 'The Villans', NULL, 0, NULL),
  ('club-nicknames', 13, 'The Addicks', NULL, 0, NULL),
  ('club-nicknames', 14, 'The Clarets', NULL, 0, NULL),
  ('club-nicknames', 15, 'The Trotters', NULL, 0, NULL),
  ('club-nicknames', 16, 'The Hornets', NULL, 0, NULL),
  ('club-nicknames', 17, 'The Royals', NULL, 0, NULL),
  ('club-nicknames', 18, 'The Lions', NULL, 0, NULL),
  ('club-nicknames', 19, 'The Canaries', NULL, 0, NULL),
  ('club-nicknames', 20, 'The Eagles', NULL, 0, NULL),
  ('club-nicknames', 21, 'The Saints', NULL, 0, NULL),
  ('club-nicknames', 22, 'The Tigers', NULL, 0, NULL),
  ('club-nicknames', 23, 'The Tykes', NULL, 0, NULL),
  ('club-nicknames', 24, 'The Rams', NULL, 0, NULL),
  ('club-nicknames', 25, 'The Black Cats', NULL, 0, NULL),
  ('club-nicknames', 26, 'The Red Devils', NULL, 0, NULL),
  ('club-nicknames', 27, 'The Tractor Boys', NULL, 0, NULL),
  ('club-nicknames', 28, 'The Cottagers', NULL, 0, NULL),
  ('club-nicknames', 29, 'The Bees', NULL, 0, NULL),
  ('club-nicknames', 30, 'The Hatters', NULL, 0, NULL);

-- ── Name 10 London football clubs
-- Watford is not in here, and that is the round working: they are in
-- Hertfordshire, and half a room will say them anyway.
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('clubs-london', 'football', 'Name 10 London football clubs', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('clubs-london', 1, 'Arsenal', NULL, 0, NULL),
  ('clubs-london', 2, 'Chelsea', NULL, 0, NULL),
  ('clubs-london', 3, 'Tottenham Hotspur', '["Tottenham", "Spurs"]', 0, NULL),
  ('clubs-london', 4, 'West Ham United', '["West Ham"]', 0, NULL),
  ('clubs-london', 5, 'Crystal Palace', NULL, 0, NULL),
  ('clubs-london', 6, 'Fulham', NULL, 0, NULL),
  ('clubs-london', 7, 'Brentford', NULL, 0, NULL),
  ('clubs-london', 8, 'Queens Park Rangers', '["QPR"]', 0, NULL),
  ('clubs-london', 9, 'Charlton Athletic', '["Charlton"]', 0, NULL),
  ('clubs-london', 10, 'Millwall', NULL, 0, NULL),
  ('clubs-london', 11, 'Leyton Orient', '["Orient"]', 0, NULL),
  ('clubs-london', 12, 'AFC Wimbledon', '["Wimbledon"]', 0, NULL),
  ('clubs-london', 13, 'Barnet', NULL, 0, NULL),
  ('clubs-london', 14, 'Bromley', NULL, 0, NULL),
  ('clubs-london', 15, 'Sutton United', '["Sutton"]', 0, NULL),
  ('clubs-london', 16, 'Dagenham and Redbridge', '["Dagenham"]', 0, NULL),
  ('clubs-london', 17, 'Wealdstone', NULL, 0, NULL);

-- ── Name 10 English league clubs whose name is one word
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('clubs-one-word', 'football',
        'Name 10 English league clubs whose name is one word', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('clubs-one-word', 1, 'Arsenal', NULL, 0, NULL),
  ('clubs-one-word', 2, 'Chelsea', NULL, 0, NULL),
  ('clubs-one-word', 3, 'Everton', NULL, 0, NULL),
  ('clubs-one-word', 4, 'Liverpool', NULL, 0, NULL),
  ('clubs-one-word', 5, 'Fulham', NULL, 0, NULL),
  ('clubs-one-word', 6, 'Watford', NULL, 0, NULL),
  ('clubs-one-word', 7, 'Millwall', NULL, 0, NULL),
  ('clubs-one-word', 8, 'Reading', NULL, 0, NULL),
  ('clubs-one-word', 9, 'Barnsley', NULL, 0, NULL),
  ('clubs-one-word', 10, 'Brentford', NULL, 0, NULL),
  ('clubs-one-word', 11, 'Burnley', NULL, 0, NULL),
  ('clubs-one-word', 12, 'Sunderland', NULL, 0, NULL),
  ('clubs-one-word', 13, 'Southampton', NULL, 0, NULL),
  ('clubs-one-word', 14, 'Middlesbrough', NULL, 0, NULL),
  ('clubs-one-word', 15, 'Blackpool', NULL, 0, NULL),
  ('clubs-one-word', 16, 'Walsall', NULL, 0, NULL),
  ('clubs-one-word', 17, 'Rochdale', NULL, 0, NULL),
  ('clubs-one-word', 18, 'Gillingham', NULL, 0, NULL),
  ('clubs-one-word', 19, 'Stevenage', NULL, 0, NULL),
  ('clubs-one-word', 20, 'Chesterfield', NULL, 0, NULL),
  ('clubs-one-word', 21, 'Morecambe', NULL, 0, NULL),
  ('clubs-one-word', 22, 'Barrow', NULL, 0, NULL);

-- Every authored round needs its registry row in tenable_rounds, or the game
-- cannot be handed it: the multiplayer freeze looks a round up there, not in
-- general_rounds. OR IGNORE, so this re-registers nothing already registered.
INSERT OR IGNORE INTO tenable_rounds (category, type, params, metric, title, answer_count)
SELECT 'general', 'general', '{"round":"' || r.slug || '"}', 'none', r.title,
       (SELECT COUNT(*) FROM general_answers a WHERE a.round_slug = r.slug)
FROM general_rounds r;
