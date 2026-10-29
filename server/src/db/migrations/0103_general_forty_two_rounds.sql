-- Forty-two more General rounds, every one a "name any ten" pool.
--
-- Written as a set rather than one at a time, so the whole batch gets the same
-- treatment: a pool comfortably longer than the board, and aliases for the way
-- the answer will actually be said out loud rather than only the way it is
-- written down. The alias lists are the substance of this migration. A round
-- can only accept what is in them, and rejecting an answer a player is right
-- about is the failure that ends an argument badly, on camera.
--
-- Four of the supplied lists were quietly short of what a player could rightly
-- claim, and are longer here:
--
--   Euro — the twenty-one eurozone members, plus the six countries that spend
--   euros without being in it (Monaco, San Marino, Vatican City, Andorra,
--   Montenegro, Kosovo). Somebody who says Monaco is not wrong about anything.
--
--   James Bond — all twenty-five Eon films rather than seventeen of them. A
--   player naming "From Russia with Love" is unambiguously right, and the
--   board should not be the one arguing.
--
--   African countries ending in A — Equatorial Guinea does too.
--
--   People rounds (Doctor Who, detectives, Hogwarts) are stored under the full
--   name with the surname aliased, because the matcher compares whole names and
--   everybody answers these with a surname.

-- ── Name 10 countries that use the euro
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-euro', 'countries', 'Name 10 countries that use the euro', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-euro', 1, 'Austria', NULL, 0, NULL),
  ('countries-euro', 2, 'Belgium', NULL, 0, NULL),
  ('countries-euro', 3, 'Bulgaria', NULL, 0, NULL),
  ('countries-euro', 4, 'Croatia', NULL, 0, NULL),
  ('countries-euro', 5, 'Cyprus', NULL, 0, NULL),
  ('countries-euro', 6, 'Estonia', NULL, 0, NULL),
  ('countries-euro', 7, 'Finland', NULL, 0, NULL),
  ('countries-euro', 8, 'France', NULL, 0, NULL),
  ('countries-euro', 9, 'Germany', NULL, 0, NULL),
  ('countries-euro', 10, 'Greece', NULL, 0, NULL),
  ('countries-euro', 11, 'Ireland', '["Republic of Ireland"]', 0, NULL),
  ('countries-euro', 12, 'Italy', NULL, 0, NULL),
  ('countries-euro', 13, 'Latvia', NULL, 0, NULL),
  ('countries-euro', 14, 'Lithuania', NULL, 0, NULL),
  ('countries-euro', 15, 'Luxembourg', NULL, 0, NULL),
  ('countries-euro', 16, 'Malta', NULL, 0, NULL),
  ('countries-euro', 17, 'Netherlands', '["Holland"]', 0, NULL),
  ('countries-euro', 18, 'Portugal', NULL, 0, NULL),
  ('countries-euro', 19, 'Slovakia', NULL, 0, NULL),
  ('countries-euro', 20, 'Slovenia', NULL, 0, NULL),
  ('countries-euro', 21, 'Spain', NULL, 0, NULL),
  ('countries-euro', 22, 'Monaco', NULL, 0, NULL),
  ('countries-euro', 23, 'San Marino', NULL, 0, NULL),
  ('countries-euro', 24, 'Vatican City', '["Vatican"]', 0, NULL),
  ('countries-euro', 25, 'Andorra', NULL, 0, NULL),
  ('countries-euro', 26, 'Montenegro', NULL, 0, NULL),
  ('countries-euro', 27, 'Kosovo', NULL, 0, NULL);

-- ── Name 10 countries in South America
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-south-america', 'countries', 'Name 10 countries in South America', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-south-america', 1, 'Argentina', NULL, 0, NULL),
  ('countries-south-america', 2, 'Bolivia', NULL, 0, NULL),
  ('countries-south-america', 3, 'Brazil', NULL, 0, NULL),
  ('countries-south-america', 4, 'Chile', NULL, 0, NULL),
  ('countries-south-america', 5, 'Colombia', NULL, 0, NULL),
  ('countries-south-america', 6, 'Ecuador', NULL, 0, NULL),
  ('countries-south-america', 7, 'Guyana', NULL, 0, NULL),
  ('countries-south-america', 8, 'Paraguay', NULL, 0, NULL),
  ('countries-south-america', 9, 'Peru', NULL, 0, NULL),
  ('countries-south-america', 10, 'Suriname', NULL, 0, NULL),
  ('countries-south-america', 11, 'Uruguay', NULL, 0, NULL),
  ('countries-south-america', 12, 'Venezuela', NULL, 0, NULL);

-- ── Name 10 countries bordering China
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-bordering-china', 'countries', 'Name 10 countries bordering China', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-bordering-china', 1, 'Russia', NULL, 0, NULL),
  ('countries-bordering-china', 2, 'Mongolia', NULL, 0, NULL),
  ('countries-bordering-china', 3, 'Kazakhstan', NULL, 0, NULL),
  ('countries-bordering-china', 4, 'Kyrgyzstan', NULL, 0, NULL),
  ('countries-bordering-china', 5, 'Tajikistan', NULL, 0, NULL),
  ('countries-bordering-china', 6, 'Afghanistan', NULL, 0, NULL),
  ('countries-bordering-china', 7, 'Pakistan', NULL, 0, NULL),
  ('countries-bordering-china', 8, 'India', NULL, 0, NULL),
  ('countries-bordering-china', 9, 'Nepal', NULL, 0, NULL),
  ('countries-bordering-china', 10, 'Bhutan', NULL, 0, NULL),
  ('countries-bordering-china', 11, 'Myanmar', '["Burma"]', 0, NULL),
  ('countries-bordering-china', 12, 'Laos', NULL, 0, NULL),
  ('countries-bordering-china', 13, 'Vietnam', NULL, 0, NULL),
  ('countries-bordering-china', 14, 'North Korea', NULL, 0, NULL);

-- ── Name 10 star signs
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('star-signs', 'culture', 'Name 10 star signs', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('star-signs', 1, 'Aries', NULL, 0, NULL),
  ('star-signs', 2, 'Taurus', NULL, 0, NULL),
  ('star-signs', 3, 'Gemini', NULL, 0, NULL),
  ('star-signs', 4, 'Cancer', NULL, 0, NULL),
  ('star-signs', 5, 'Leo', NULL, 0, NULL),
  ('star-signs', 6, 'Virgo', NULL, 0, NULL),
  ('star-signs', 7, 'Libra', NULL, 0, NULL),
  ('star-signs', 8, 'Scorpio', '["Scorpius"]', 0, NULL),
  ('star-signs', 9, 'Sagittarius', NULL, 0, NULL),
  ('star-signs', 10, 'Capricorn', NULL, 0, NULL),
  ('star-signs', 11, 'Aquarius', NULL, 0, NULL),
  ('star-signs', 12, 'Pisces', NULL, 0, NULL);

-- ── Name 10 Summer Olympic host cities since 1980
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('summer-olympic-hosts', 'sport', 'Name 10 Summer Olympic host cities since 1980', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('summer-olympic-hosts', 1, 'Moscow', NULL, 0, NULL),
  ('summer-olympic-hosts', 2, 'Los Angeles', '["LA"]', 0, NULL),
  ('summer-olympic-hosts', 3, 'Seoul', NULL, 0, NULL),
  ('summer-olympic-hosts', 4, 'Barcelona', NULL, 0, NULL),
  ('summer-olympic-hosts', 5, 'Atlanta', NULL, 0, NULL),
  ('summer-olympic-hosts', 6, 'Sydney', NULL, 0, NULL),
  ('summer-olympic-hosts', 7, 'Athens', NULL, 0, NULL),
  ('summer-olympic-hosts', 8, 'Beijing', NULL, 0, NULL),
  ('summer-olympic-hosts', 9, 'London', NULL, 0, NULL),
  ('summer-olympic-hosts', 10, 'Rio de Janeiro', '["Rio"]', 0, NULL),
  ('summer-olympic-hosts', 11, 'Tokyo', NULL, 0, NULL),
  ('summer-olympic-hosts', 12, 'Paris', NULL, 0, NULL);

-- ── Name 10 words that come before "house"
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('words-before-house', 'words', 'Name 10 words that come before "house"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('words-before-house', 1, 'Green', '["greenhouse"]', 0, NULL),
  ('words-before-house', 2, 'Light', '["lighthouse"]', 0, NULL),
  ('words-before-house', 3, 'Ware', '["warehouse"]', 0, NULL),
  ('words-before-house', 4, 'Farm', '["farmhouse"]', 0, NULL),
  ('words-before-house', 5, 'Court', '["courthouse"]', 0, NULL),
  ('words-before-house', 6, 'Club', '["clubhouse"]', 0, NULL),
  ('words-before-house', 7, 'Dog', '["doghouse"]', 0, NULL),
  ('words-before-house', 8, 'Play', '["playhouse"]', 0, NULL),
  ('words-before-house', 9, 'Tree', '["treehouse"]', 0, NULL),
  ('words-before-house', 10, 'Doll', '["doll''s house","dollhouse"]', 0, NULL),
  ('words-before-house', 11, 'Guest', '["guesthouse"]', 0, NULL),
  ('words-before-house', 12, 'Power', '["powerhouse"]', 0, NULL),
  ('words-before-house', 13, 'Mad', '["madhouse"]', 0, NULL),
  ('words-before-house', 14, 'Hen', '["henhouse"]', 0, NULL),
  ('words-before-house', 15, 'Opera', '["opera house"]', 0, NULL),
  ('words-before-house', 16, 'Boat', '["boathouse"]', 0, NULL),
  ('words-before-house', 17, 'Bath', '["bathhouse"]', 0, NULL);

-- ── Name 10 types of pasta
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('pasta-types', 'food', 'Name 10 types of pasta', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('pasta-types', 1, 'Spaghetti', NULL, 0, NULL),
  ('pasta-types', 2, 'Penne', NULL, 0, NULL),
  ('pasta-types', 3, 'Fusilli', NULL, 0, NULL),
  ('pasta-types', 4, 'Farfalle', NULL, 0, NULL),
  ('pasta-types', 5, 'Linguine', '["linguini"]', 0, NULL),
  ('pasta-types', 6, 'Tagliatelle', NULL, 0, NULL),
  ('pasta-types', 7, 'Rigatoni', NULL, 0, NULL),
  ('pasta-types', 8, 'Macaroni', NULL, 0, NULL),
  ('pasta-types', 9, 'Lasagne', '["lasagna"]', 0, NULL),
  ('pasta-types', 10, 'Ravioli', NULL, 0, NULL),
  ('pasta-types', 11, 'Tortellini', NULL, 0, NULL),
  ('pasta-types', 12, 'Orzo', NULL, 0, NULL),
  ('pasta-types', 13, 'Fettuccine', '["fettuccini","fettucine"]', 0, NULL),
  ('pasta-types', 14, 'Conchiglie', NULL, 0, NULL),
  ('pasta-types', 15, 'Pappardelle', NULL, 0, NULL);

-- ── Name 10 types of cheese
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('cheese-types', 'food', 'Name 10 types of cheese', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('cheese-types', 1, 'Cheddar', NULL, 0, NULL),
  ('cheese-types', 2, 'Brie', NULL, 0, NULL),
  ('cheese-types', 3, 'Camembert', NULL, 0, NULL),
  ('cheese-types', 4, 'Stilton', NULL, 0, NULL),
  ('cheese-types', 5, 'Mozzarella', NULL, 0, NULL),
  ('cheese-types', 6, 'Parmesan', '["parmigiano","parmigiano reggiano"]', 0, NULL),
  ('cheese-types', 7, 'Feta', NULL, 0, NULL),
  ('cheese-types', 8, 'Gouda', NULL, 0, NULL),
  ('cheese-types', 9, 'Edam', NULL, 0, NULL),
  ('cheese-types', 10, 'Red Leicester', NULL, 0, NULL),
  ('cheese-types', 11, 'Wensleydale', NULL, 0, NULL),
  ('cheese-types', 12, 'Halloumi', NULL, 0, NULL),
  ('cheese-types', 13, 'Gruyère', '["gruyere"]', 0, NULL),
  ('cheese-types', 14, 'Emmental', '["emmenthal","emmentaler"]', 0, NULL),
  ('cheese-types', 15, 'Roquefort', NULL, 0, NULL),
  ('cheese-types', 16, 'Manchego', NULL, 0, NULL);

-- ── Name 10 Shakespeare plays
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('shakespeare-plays', 'literature', 'Name 10 Shakespeare plays', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('shakespeare-plays', 1, 'Hamlet', NULL, 0, NULL),
  ('shakespeare-plays', 2, 'Macbeth', NULL, 0, NULL),
  ('shakespeare-plays', 3, 'Othello', NULL, 0, NULL),
  ('shakespeare-plays', 4, 'King Lear', NULL, 0, NULL),
  ('shakespeare-plays', 5, 'Romeo and Juliet', NULL, 0, NULL),
  ('shakespeare-plays', 6, 'The Tempest', NULL, 0, NULL),
  ('shakespeare-plays', 7, 'A Midsummer Night''s Dream', '["midsummer nights dream"]', 0, NULL),
  ('shakespeare-plays', 8, 'Twelfth Night', NULL, 0, NULL),
  ('shakespeare-plays', 9, 'Much Ado About Nothing', '["much ado"]', 0, NULL),
  ('shakespeare-plays', 10, 'The Merchant of Venice', NULL, 0, NULL),
  ('shakespeare-plays', 11, 'Julius Caesar', NULL, 0, NULL),
  ('shakespeare-plays', 12, 'As You Like It', NULL, 0, NULL),
  ('shakespeare-plays', 13, 'Richard III', '["richard the third"]', 0, NULL),
  ('shakespeare-plays', 14, 'Henry V', '["henry the fifth"]', 0, NULL),
  ('shakespeare-plays', 15, 'Antony and Cleopatra', NULL, 0, NULL),
  ('shakespeare-plays', 16, 'The Taming of the Shrew', NULL, 0, NULL);

-- ── Name 10 board games
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('board-games', 'games', 'Name 10 board games', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('board-games', 1, 'Monopoly', NULL, 0, NULL),
  ('board-games', 2, 'Scrabble', NULL, 0, NULL),
  ('board-games', 3, 'Cluedo', '["clue"]', 0, NULL),
  ('board-games', 4, 'Risk', NULL, 0, NULL),
  ('board-games', 5, 'Trivial Pursuit', NULL, 0, NULL),
  ('board-games', 6, 'Chess', NULL, 0, NULL),
  ('board-games', 7, 'Draughts', '["checkers"]', 0, NULL),
  ('board-games', 8, 'Backgammon', NULL, 0, NULL),
  ('board-games', 9, 'Snakes and Ladders', NULL, 0, NULL),
  ('board-games', 10, 'Ludo', NULL, 0, NULL),
  ('board-games', 11, 'Guess Who', NULL, 0, NULL),
  ('board-games', 12, 'Operation', NULL, 0, NULL),
  ('board-games', 13, 'Mouse Trap', '["mousetrap"]', 0, NULL),
  ('board-games', 14, 'Battleships', '["battleship"]', 0, NULL),
  ('board-games', 15, 'Catan', '["settlers of catan"]', 0, NULL),
  ('board-games', 16, 'Pictionary', NULL, 0, NULL);

-- ── Name 10 English football clubs with "United" in their name
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('united-clubs', 'sport', 'Name 10 English football clubs with "United" in their name', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('united-clubs', 1, 'Manchester United', '["man utd","man united","united"]', 0, NULL),
  ('united-clubs', 2, 'Newcastle United', '["newcastle"]', 0, NULL),
  ('united-clubs', 3, 'West Ham United', '["west ham"]', 0, NULL),
  ('united-clubs', 4, 'Leeds United', '["leeds"]', 0, NULL),
  ('united-clubs', 5, 'Sheffield United', '["sheffield"]', 0, NULL),
  ('united-clubs', 6, 'Southend United', '["southend"]', 0, NULL),
  ('united-clubs', 7, 'Oxford United', '["oxford"]', 0, NULL),
  ('united-clubs', 8, 'Cambridge United', '["cambridge"]', 0, NULL),
  ('united-clubs', 9, 'Carlisle United', '["carlisle"]', 0, NULL),
  ('united-clubs', 10, 'Hartlepool United', '["hartlepool"]', 0, NULL),
  ('united-clubs', 11, 'Peterborough United', '["peterborough"]', 0, NULL),
  ('united-clubs', 12, 'Scunthorpe United', '["scunthorpe"]', 0, NULL),
  ('united-clubs', 13, 'Torquay United', '["torquay"]', 0, NULL),
  ('united-clubs', 14, 'Rotherham United', '["rotherham"]', 0, NULL),
  ('united-clubs', 15, 'Colchester United', '["colchester"]', 0, NULL);

-- ── Name 10 African countries ending in "A"
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('african-countries-ending-a', 'countries', 'Name 10 African countries ending in "A"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('african-countries-ending-a', 1, 'Algeria', NULL, 0, NULL),
  ('african-countries-ending-a', 2, 'Libya', NULL, 0, NULL),
  ('african-countries-ending-a', 3, 'Nigeria', NULL, 0, NULL),
  ('african-countries-ending-a', 4, 'Kenya', NULL, 0, NULL),
  ('african-countries-ending-a', 5, 'Ghana', NULL, 0, NULL),
  ('african-countries-ending-a', 6, 'Zambia', NULL, 0, NULL),
  ('african-countries-ending-a', 7, 'Namibia', NULL, 0, NULL),
  ('african-countries-ending-a', 8, 'Tanzania', NULL, 0, NULL),
  ('african-countries-ending-a', 9, 'Ethiopia', NULL, 0, NULL),
  ('african-countries-ending-a', 10, 'Somalia', NULL, 0, NULL),
  ('african-countries-ending-a', 11, 'Liberia', NULL, 0, NULL),
  ('african-countries-ending-a', 12, 'Gambia', '["the gambia"]', 0, NULL),
  ('african-countries-ending-a', 13, 'Guinea', NULL, 0, NULL),
  ('african-countries-ending-a', 14, 'Eritrea', NULL, 0, NULL),
  ('african-countries-ending-a', 15, 'Mauritania', NULL, 0, NULL),
  ('african-countries-ending-a', 16, 'Botswana', NULL, 0, NULL),
  ('african-countries-ending-a', 17, 'Uganda', NULL, 0, NULL),
  ('african-countries-ending-a', 18, 'Rwanda', NULL, 0, NULL),
  ('african-countries-ending-a', 19, 'Angola', NULL, 0, NULL),
  ('african-countries-ending-a', 20, 'South Africa', NULL, 0, NULL),
  ('african-countries-ending-a', 21, 'Equatorial Guinea', NULL, 0, NULL);

-- ── Name 10 US states ending in "A"
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-states-ending-a', 'states', 'Name 10 US states ending in "A"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-states-ending-a', 1, 'Alabama', NULL, 0, NULL),
  ('us-states-ending-a', 2, 'Alaska', NULL, 0, NULL),
  ('us-states-ending-a', 3, 'Arizona', NULL, 0, NULL),
  ('us-states-ending-a', 4, 'California', NULL, 0, NULL),
  ('us-states-ending-a', 5, 'Florida', NULL, 0, NULL),
  ('us-states-ending-a', 6, 'Georgia', NULL, 0, NULL),
  ('us-states-ending-a', 7, 'Indiana', NULL, 0, NULL),
  ('us-states-ending-a', 8, 'Iowa', NULL, 0, NULL),
  ('us-states-ending-a', 9, 'Louisiana', NULL, 0, NULL),
  ('us-states-ending-a', 10, 'Minnesota', NULL, 0, NULL),
  ('us-states-ending-a', 11, 'Montana', NULL, 0, NULL),
  ('us-states-ending-a', 12, 'Nebraska', NULL, 0, NULL),
  ('us-states-ending-a', 13, 'Nevada', NULL, 0, NULL),
  ('us-states-ending-a', 14, 'North Carolina', NULL, 0, NULL),
  ('us-states-ending-a', 15, 'North Dakota', NULL, 0, NULL),
  ('us-states-ending-a', 16, 'Oklahoma', NULL, 0, NULL),
  ('us-states-ending-a', 17, 'Pennsylvania', NULL, 0, NULL),
  ('us-states-ending-a', 18, 'South Carolina', NULL, 0, NULL),
  ('us-states-ending-a', 19, 'South Dakota', NULL, 0, NULL),
  ('us-states-ending-a', 20, 'Virginia', NULL, 0, NULL),
  ('us-states-ending-a', 21, 'West Virginia', NULL, 0, NULL);

-- ── Name 10 capital cities beginning with "B"
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('capitals-b', 'capitals', 'Name 10 capital cities beginning with "B"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('capitals-b', 1, 'Berlin', NULL, 0, NULL),
  ('capitals-b', 2, 'Brussels', NULL, 0, NULL),
  ('capitals-b', 3, 'Budapest', NULL, 0, NULL),
  ('capitals-b', 4, 'Bucharest', NULL, 0, NULL),
  ('capitals-b', 5, 'Belgrade', NULL, 0, NULL),
  ('capitals-b', 6, 'Bern', NULL, 0, NULL),
  ('capitals-b', 7, 'Bratislava', NULL, 0, NULL),
  ('capitals-b', 8, 'Beijing', NULL, 0, NULL),
  ('capitals-b', 9, 'Bangkok', NULL, 0, NULL),
  ('capitals-b', 10, 'Buenos Aires', NULL, 0, NULL),
  ('capitals-b', 11, 'Bogotá', '["bogota"]', 0, NULL),
  ('capitals-b', 12, 'Baghdad', NULL, 0, NULL),
  ('capitals-b', 13, 'Beirut', NULL, 0, NULL),
  ('capitals-b', 14, 'Baku', NULL, 0, NULL),
  ('capitals-b', 15, 'Brasília', '["brasilia"]', 0, NULL),
  ('capitals-b', 16, 'Bamako', NULL, 0, NULL),
  ('capitals-b', 17, 'Bishkek', NULL, 0, NULL),
  ('capitals-b', 18, 'Bridgetown', NULL, 0, NULL),
  ('capitals-b', 19, 'Belmopan', NULL, 0, NULL),
  ('capitals-b', 20, 'Brazzaville', NULL, 0, NULL);

-- ── Name 10 Hogwarts staff members
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('hogwarts-staff', 'film', 'Name 10 Hogwarts staff members', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('hogwarts-staff', 1, 'Dumbledore', '["albus dumbledore","professor dumbledore"]', 0, NULL),
  ('hogwarts-staff', 2, 'McGonagall', '["minerva mcgonagall","professor mcgonagall"]', 0, NULL),
  ('hogwarts-staff', 3, 'Snape', '["severus snape","professor snape"]', 0, NULL),
  ('hogwarts-staff', 4, 'Hagrid', '["rubeus hagrid"]', 0, NULL),
  ('hogwarts-staff', 5, 'Flitwick', '["filius flitwick","professor flitwick"]', 0, NULL),
  ('hogwarts-staff', 6, 'Sprout', '["pomona sprout","professor sprout"]', 0, NULL),
  ('hogwarts-staff', 7, 'Slughorn', '["horace slughorn","professor slughorn"]', 0, NULL),
  ('hogwarts-staff', 8, 'Lupin', '["remus lupin","professor lupin"]', 0, NULL),
  ('hogwarts-staff', 9, 'Lockhart', '["gilderoy lockhart","professor lockhart"]', 0, NULL),
  ('hogwarts-staff', 10, 'Quirrell', '["quirinus quirrell","professor quirrell"]', 0, NULL),
  ('hogwarts-staff', 11, 'Trelawney', '["sybill trelawney","professor trelawney"]', 0, NULL),
  ('hogwarts-staff', 12, 'Filch', '["argus filch"]', 0, NULL),
  ('hogwarts-staff', 13, 'Hooch', '["madam hooch","rolanda hooch"]', 0, NULL),
  ('hogwarts-staff', 14, 'Binns', '["professor binns","cuthbert binns"]', 0, NULL),
  ('hogwarts-staff', 15, 'Umbridge', '["dolores umbridge","professor umbridge"]', 0, NULL),
  ('hogwarts-staff', 16, 'Pomfrey', '["madam pomfrey","poppy pomfrey"]', 0, NULL),
  ('hogwarts-staff', 17, 'Firenze', NULL, 0, NULL),
  ('hogwarts-staff', 18, 'Moody', '["alastor moody","mad eye moody","mad-eye moody"]', 0, NULL);

-- ── Name 10 James Bond films
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('james-bond-films', 'film', 'Name 10 James Bond films', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('james-bond-films', 1, 'Dr. No', '["dr no","doctor no"]', 0, NULL),
  ('james-bond-films', 2, 'From Russia with Love', NULL, 0, NULL),
  ('james-bond-films', 3, 'Goldfinger', NULL, 0, NULL),
  ('james-bond-films', 4, 'Thunderball', NULL, 0, NULL),
  ('james-bond-films', 5, 'You Only Live Twice', NULL, 0, NULL),
  ('james-bond-films', 6, 'On Her Majesty''s Secret Service', '["on her majestys secret service"]', 0, NULL),
  ('james-bond-films', 7, 'Diamonds Are Forever', NULL, 0, NULL),
  ('james-bond-films', 8, 'Live and Let Die', NULL, 0, NULL),
  ('james-bond-films', 9, 'The Man with the Golden Gun', NULL, 0, NULL),
  ('james-bond-films', 10, 'The Spy Who Loved Me', NULL, 0, NULL),
  ('james-bond-films', 11, 'Moonraker', NULL, 0, NULL),
  ('james-bond-films', 12, 'For Your Eyes Only', NULL, 0, NULL),
  ('james-bond-films', 13, 'Octopussy', NULL, 0, NULL),
  ('james-bond-films', 14, 'A View to a Kill', NULL, 0, NULL),
  ('james-bond-films', 15, 'The Living Daylights', NULL, 0, NULL),
  ('james-bond-films', 16, 'Licence to Kill', '["license to kill"]', 0, NULL),
  ('james-bond-films', 17, 'GoldenEye', NULL, 0, NULL),
  ('james-bond-films', 18, 'Tomorrow Never Dies', NULL, 0, NULL),
  ('james-bond-films', 19, 'The World Is Not Enough', NULL, 0, NULL),
  ('james-bond-films', 20, 'Die Another Day', NULL, 0, NULL),
  ('james-bond-films', 21, 'Casino Royale', NULL, 0, NULL),
  ('james-bond-films', 22, 'Quantum of Solace', NULL, 0, NULL),
  ('james-bond-films', 23, 'Skyfall', NULL, 0, NULL),
  ('james-bond-films', 24, 'Spectre', NULL, 0, NULL),
  ('james-bond-films', 25, 'No Time to Die', NULL, 0, NULL);

-- ── Name 10 Beatles songs
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('beatles-songs', 'music', 'Name 10 Beatles songs', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('beatles-songs', 1, 'Hey Jude', NULL, 0, NULL),
  ('beatles-songs', 2, 'Let It Be', NULL, 0, NULL),
  ('beatles-songs', 3, 'Yesterday', NULL, 0, NULL),
  ('beatles-songs', 4, 'Help!', '["help"]', 0, NULL),
  ('beatles-songs', 5, 'Something', NULL, 0, NULL),
  ('beatles-songs', 6, 'Come Together', NULL, 0, NULL),
  ('beatles-songs', 7, 'Yellow Submarine', NULL, 0, NULL),
  ('beatles-songs', 8, 'Penny Lane', NULL, 0, NULL),
  ('beatles-songs', 9, 'Strawberry Fields Forever', NULL, 0, NULL),
  ('beatles-songs', 10, 'Here Comes the Sun', NULL, 0, NULL),
  ('beatles-songs', 11, 'Eleanor Rigby', NULL, 0, NULL),
  ('beatles-songs', 12, 'Love Me Do', NULL, 0, NULL),
  ('beatles-songs', 13, 'She Loves You', NULL, 0, NULL),
  ('beatles-songs', 14, 'A Hard Day''s Night', '["a hard days night"]', 0, NULL),
  ('beatles-songs', 15, 'All You Need Is Love', NULL, 0, NULL),
  ('beatles-songs', 16, 'Blackbird', NULL, 0, NULL),
  ('beatles-songs', 17, 'Get Back', NULL, 0, NULL);

-- ── Name 10 actors who've played the Doctor in Doctor Who
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('doctor-who-actors', 'tv', 'Name 10 actors who''ve played the Doctor in Doctor Who', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('doctor-who-actors', 1, 'William Hartnell', '["hartnell"]', 0, NULL),
  ('doctor-who-actors', 2, 'Patrick Troughton', '["troughton"]', 0, NULL),
  ('doctor-who-actors', 3, 'Jon Pertwee', '["pertwee"]', 0, NULL),
  ('doctor-who-actors', 4, 'Tom Baker', NULL, 0, NULL),
  ('doctor-who-actors', 5, 'Peter Davison', '["davison"]', 0, NULL),
  ('doctor-who-actors', 6, 'Colin Baker', NULL, 0, NULL),
  ('doctor-who-actors', 7, 'Sylvester McCoy', '["mccoy"]', 0, NULL),
  ('doctor-who-actors', 8, 'Paul McGann', '["mcgann"]', 0, NULL),
  ('doctor-who-actors', 9, 'John Hurt', '["hurt"]', 0, NULL),
  ('doctor-who-actors', 10, 'Christopher Eccleston', '["eccleston"]', 0, NULL),
  ('doctor-who-actors', 11, 'David Tennant', '["tennant"]', 0, NULL),
  ('doctor-who-actors', 12, 'Matt Smith', NULL, 0, NULL),
  ('doctor-who-actors', 13, 'Peter Capaldi', '["capaldi"]', 0, NULL),
  ('doctor-who-actors', 14, 'Jodie Whittaker', '["whittaker"]', 0, NULL),
  ('doctor-who-actors', 15, 'Ncuti Gatwa', '["gatwa"]', 0, NULL);

-- ── Name 10 smartphone brands
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('smartphone-brands', 'tech', 'Name 10 smartphone brands', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('smartphone-brands', 1, 'Apple', '["iphone"]', 0, NULL),
  ('smartphone-brands', 2, 'Samsung', NULL, 0, NULL),
  ('smartphone-brands', 3, 'Google', '["pixel"]', 0, NULL),
  ('smartphone-brands', 4, 'OnePlus', NULL, 0, NULL),
  ('smartphone-brands', 5, 'Xiaomi', NULL, 0, NULL),
  ('smartphone-brands', 6, 'Oppo', NULL, 0, NULL),
  ('smartphone-brands', 7, 'Vivo', NULL, 0, NULL),
  ('smartphone-brands', 8, 'Huawei', NULL, 0, NULL),
  ('smartphone-brands', 9, 'Honor', '["honour"]', 0, NULL),
  ('smartphone-brands', 10, 'Motorola', '["moto"]', 0, NULL),
  ('smartphone-brands', 11, 'Nokia', NULL, 0, NULL),
  ('smartphone-brands', 12, 'Sony', NULL, 0, NULL),
  ('smartphone-brands', 13, 'Nothing', NULL, 0, NULL),
  ('smartphone-brands', 14, 'Realme', NULL, 0, NULL),
  ('smartphone-brands', 15, 'Asus', NULL, 0, NULL),
  ('smartphone-brands', 16, 'Fairphone', NULL, 0, NULL),
  ('smartphone-brands', 17, 'BlackBerry', NULL, 0, NULL),
  ('smartphone-brands', 18, 'HTC', NULL, 0, NULL),
  ('smartphone-brands', 19, 'LG', NULL, 0, NULL);

-- ── Name 10 social media apps
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('social-media-apps', 'tech', 'Name 10 social media apps', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('social-media-apps', 1, 'Instagram', '["insta"]', 0, NULL),
  ('social-media-apps', 2, 'TikTok', NULL, 0, NULL),
  ('social-media-apps', 3, 'Facebook', NULL, 0, NULL),
  ('social-media-apps', 4, 'X', '["twitter"]', 0, NULL),
  ('social-media-apps', 5, 'Snapchat', '["snap"]', 0, NULL),
  ('social-media-apps', 6, 'YouTube', NULL, 0, NULL),
  ('social-media-apps', 7, 'WhatsApp', NULL, 0, NULL),
  ('social-media-apps', 8, 'Pinterest', NULL, 0, NULL),
  ('social-media-apps', 9, 'LinkedIn', NULL, 0, NULL),
  ('social-media-apps', 10, 'Reddit', NULL, 0, NULL),
  ('social-media-apps', 11, 'Threads', NULL, 0, NULL),
  ('social-media-apps', 12, 'Bluesky', NULL, 0, NULL),
  ('social-media-apps', 13, 'Discord', NULL, 0, NULL),
  ('social-media-apps', 14, 'Tumblr', '["tumbler"]', 0, NULL),
  ('social-media-apps', 15, 'Twitch', NULL, 0, NULL),
  ('social-media-apps', 16, 'BeReal', NULL, 0, NULL);

-- ── Name 10 Japanese car makers
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('japanese-car-makers', 'transport', 'Name 10 Japanese car makers', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('japanese-car-makers', 1, 'Toyota', NULL, 0, NULL),
  ('japanese-car-makers', 2, 'Honda', NULL, 0, NULL),
  ('japanese-car-makers', 3, 'Nissan', NULL, 0, NULL),
  ('japanese-car-makers', 4, 'Mazda', NULL, 0, NULL),
  ('japanese-car-makers', 5, 'Subaru', NULL, 0, NULL),
  ('japanese-car-makers', 6, 'Mitsubishi', NULL, 0, NULL),
  ('japanese-car-makers', 7, 'Suzuki', NULL, 0, NULL),
  ('japanese-car-makers', 8, 'Lexus', NULL, 0, NULL),
  ('japanese-car-makers', 9, 'Infiniti', NULL, 0, NULL),
  ('japanese-car-makers', 10, 'Acura', NULL, 0, NULL),
  ('japanese-car-makers', 11, 'Daihatsu', NULL, 0, NULL),
  ('japanese-car-makers', 12, 'Isuzu', NULL, 0, NULL);

-- ── Name 10 Avengers in the Marvel films
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('mcu-avengers', 'film', 'Name 10 Avengers in the Marvel films', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('mcu-avengers', 1, 'Iron Man', '["ironman","tony stark"]', 0, NULL),
  ('mcu-avengers', 2, 'Captain America', '["steve rogers","cap"]', 0, NULL),
  ('mcu-avengers', 3, 'Thor', NULL, 0, NULL),
  ('mcu-avengers', 4, 'Hulk', '["bruce banner"]', 0, NULL),
  ('mcu-avengers', 5, 'Black Widow', '["natasha romanoff"]', 0, NULL),
  ('mcu-avengers', 6, 'Hawkeye', '["clint barton"]', 0, NULL),
  ('mcu-avengers', 7, 'Spider-Man', '["spiderman","peter parker"]', 0, NULL),
  ('mcu-avengers', 8, 'Black Panther', '["tchalla"]', 0, NULL),
  ('mcu-avengers', 9, 'Doctor Strange', '["dr strange","stephen strange"]', 0, NULL),
  ('mcu-avengers', 10, 'Scarlet Witch', '["wanda","wanda maximoff"]', 0, NULL),
  ('mcu-avengers', 11, 'Vision', NULL, 0, NULL),
  ('mcu-avengers', 12, 'Ant-Man', '["antman","scott lang"]', 0, NULL),
  ('mcu-avengers', 13, 'Wasp', '["hope van dyne"]', 0, NULL),
  ('mcu-avengers', 14, 'Captain Marvel', '["carol danvers"]', 0, NULL),
  ('mcu-avengers', 15, 'Falcon', '["sam wilson"]', 0, NULL),
  ('mcu-avengers', 16, 'War Machine', '["rhodey","james rhodes"]', 0, NULL);

-- ── Name 10 elements that are gases at room temperature
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('gas-elements', 'science', 'Name 10 elements that are gases at room temperature', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('gas-elements', 1, 'Hydrogen', NULL, 0, NULL),
  ('gas-elements', 2, 'Helium', NULL, 0, NULL),
  ('gas-elements', 3, 'Nitrogen', NULL, 0, NULL),
  ('gas-elements', 4, 'Oxygen', NULL, 0, NULL),
  ('gas-elements', 5, 'Fluorine', NULL, 0, NULL),
  ('gas-elements', 6, 'Neon', NULL, 0, NULL),
  ('gas-elements', 7, 'Chlorine', NULL, 0, NULL),
  ('gas-elements', 8, 'Argon', NULL, 0, NULL),
  ('gas-elements', 9, 'Krypton', NULL, 0, NULL),
  ('gas-elements', 10, 'Xenon', NULL, 0, NULL),
  ('gas-elements', 11, 'Radon', NULL, 0, NULL);

-- ── Name 10 organs in the human body
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('human-organs', 'science', 'Name 10 organs in the human body', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('human-organs', 1, 'Heart', NULL, 0, NULL),
  ('human-organs', 2, 'Lungs', '["lung"]', 0, NULL),
  ('human-organs', 3, 'Liver', NULL, 0, NULL),
  ('human-organs', 4, 'Kidneys', '["kidney"]', 0, NULL),
  ('human-organs', 5, 'Brain', NULL, 0, NULL),
  ('human-organs', 6, 'Stomach', NULL, 0, NULL),
  ('human-organs', 7, 'Pancreas', NULL, 0, NULL),
  ('human-organs', 8, 'Spleen', NULL, 0, NULL),
  ('human-organs', 9, 'Gallbladder', '["gall bladder"]', 0, NULL),
  ('human-organs', 10, 'Bladder', NULL, 0, NULL),
  ('human-organs', 11, 'Intestines', '["intestine","bowel","bowels","guts"]', 0, NULL),
  ('human-organs', 12, 'Skin', NULL, 0, NULL),
  ('human-organs', 13, 'Appendix', NULL, 0, NULL),
  ('human-organs', 14, 'Oesophagus', '["esophagus","gullet"]', 0, NULL),
  ('human-organs', 15, 'Thyroid', NULL, 0, NULL);

-- ── Name 10 herbs and spices
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('herbs-and-spices', 'food', 'Name 10 herbs and spices', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('herbs-and-spices', 1, 'Basil', NULL, 0, NULL),
  ('herbs-and-spices', 2, 'Oregano', NULL, 0, NULL),
  ('herbs-and-spices', 3, 'Thyme', NULL, 0, NULL),
  ('herbs-and-spices', 4, 'Rosemary', NULL, 0, NULL),
  ('herbs-and-spices', 5, 'Sage', NULL, 0, NULL),
  ('herbs-and-spices', 6, 'Parsley', NULL, 0, NULL),
  ('herbs-and-spices', 7, 'Coriander', '["cilantro"]', 0, NULL),
  ('herbs-and-spices', 8, 'Mint', NULL, 0, NULL),
  ('herbs-and-spices', 9, 'Dill', NULL, 0, NULL),
  ('herbs-and-spices', 10, 'Cumin', NULL, 0, NULL),
  ('herbs-and-spices', 11, 'Paprika', NULL, 0, NULL),
  ('herbs-and-spices', 12, 'Turmeric', NULL, 0, NULL),
  ('herbs-and-spices', 13, 'Cinnamon', NULL, 0, NULL),
  ('herbs-and-spices', 14, 'Nutmeg', NULL, 0, NULL),
  ('herbs-and-spices', 15, 'Ginger', NULL, 0, NULL),
  ('herbs-and-spices', 16, 'Cardamom', '["cardamon"]', 0, NULL),
  ('herbs-and-spices', 17, 'Saffron', NULL, 0, NULL);

-- ── Name 10 cocktails
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('cocktails', 'food', 'Name 10 cocktails', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('cocktails', 1, 'Mojito', NULL, 0, NULL),
  ('cocktails', 2, 'Margarita', NULL, 0, NULL),
  ('cocktails', 3, 'Martini', NULL, 0, NULL),
  ('cocktails', 4, 'Cosmopolitan', '["cosmo"]', 0, NULL),
  ('cocktails', 5, 'Piña Colada', '["pina colada"]', 0, NULL),
  ('cocktails', 6, 'Daiquiri', NULL, 0, NULL),
  ('cocktails', 7, 'Negroni', NULL, 0, NULL),
  ('cocktails', 8, 'Old Fashioned', NULL, 0, NULL),
  ('cocktails', 9, 'Manhattan', NULL, 0, NULL),
  ('cocktails', 10, 'Bloody Mary', NULL, 0, NULL),
  ('cocktails', 11, 'Espresso Martini', NULL, 0, NULL),
  ('cocktails', 12, 'Long Island Iced Tea', NULL, 0, NULL),
  ('cocktails', 13, 'Mai Tai', NULL, 0, NULL),
  ('cocktails', 14, 'Aperol Spritz', NULL, 0, NULL),
  ('cocktails', 15, 'Caipirinha', NULL, 0, NULL);

-- ── Name 10 chocolate bars sold in the UK
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('uk-chocolate-bars', 'food', 'Name 10 chocolate bars sold in the UK', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('uk-chocolate-bars', 1, 'Mars', NULL, 0, NULL),
  ('uk-chocolate-bars', 2, 'Snickers', NULL, 0, NULL),
  ('uk-chocolate-bars', 3, 'Twix', NULL, 0, NULL),
  ('uk-chocolate-bars', 4, 'Bounty', NULL, 0, NULL),
  ('uk-chocolate-bars', 5, 'Galaxy', NULL, 0, NULL),
  ('uk-chocolate-bars', 6, 'Dairy Milk', NULL, 0, NULL),
  ('uk-chocolate-bars', 7, 'Wispa', NULL, 0, NULL),
  ('uk-chocolate-bars', 8, 'Twirl', NULL, 0, NULL),
  ('uk-chocolate-bars', 9, 'Flake', NULL, 0, NULL),
  ('uk-chocolate-bars', 10, 'Crunchie', NULL, 0, NULL),
  ('uk-chocolate-bars', 11, 'KitKat', '["kit kat"]', 0, NULL),
  ('uk-chocolate-bars', 12, 'Aero', NULL, 0, NULL),
  ('uk-chocolate-bars', 13, 'Yorkie', NULL, 0, NULL),
  ('uk-chocolate-bars', 14, 'Double Decker', NULL, 0, NULL),
  ('uk-chocolate-bars', 15, 'Boost', NULL, 0, NULL),
  ('uk-chocolate-bars', 16, 'Picnic', NULL, 0, NULL),
  ('uk-chocolate-bars', 17, 'Lion', '["lion bar"]', 0, NULL),
  ('uk-chocolate-bars', 18, 'Toffee Crisp', NULL, 0, NULL),
  ('uk-chocolate-bars', 19, 'Milky Way', NULL, 0, NULL),
  ('uk-chocolate-bars', 20, 'Curly Wurly', NULL, 0, NULL);

-- ── Name 10 crisp flavours
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('crisp-flavours', 'food', 'Name 10 crisp flavours', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('crisp-flavours', 1, 'Ready salted', NULL, 0, NULL),
  ('crisp-flavours', 2, 'Salt & vinegar', '["salt and vinegar"]', 0, NULL),
  ('crisp-flavours', 3, 'Cheese & onion', '["cheese and onion"]', 0, NULL),
  ('crisp-flavours', 4, 'Prawn cocktail', NULL, 0, NULL),
  ('crisp-flavours', 5, 'Smoky bacon', '["smokey bacon"]', 0, NULL),
  ('crisp-flavours', 6, 'Roast chicken', NULL, 0, NULL),
  ('crisp-flavours', 7, 'Sour cream & chive', '["sour cream and chive","sour cream and chives"]', 0, NULL),
  ('crisp-flavours', 8, 'BBQ', '["barbecue","barbeque"]', 0, NULL),
  ('crisp-flavours', 9, 'Pickled onion', NULL, 0, NULL),
  ('crisp-flavours', 10, 'Beef', NULL, 0, NULL),
  ('crisp-flavours', 11, 'Worcester sauce', '["worcestershire sauce"]', 0, NULL),
  ('crisp-flavours', 12, 'Sweet chilli', '["sweet chili"]', 0, NULL),
  ('crisp-flavours', 13, 'Paprika', NULL, 0, NULL);

-- ── Name 10 card games
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('card-games', 'games', 'Name 10 card games', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('card-games', 1, 'Poker', NULL, 0, NULL),
  ('card-games', 2, 'Blackjack', '["pontoon","twenty one"]', 0, NULL),
  ('card-games', 3, 'Rummy', NULL, 0, NULL),
  ('card-games', 4, 'Snap', NULL, 0, NULL),
  ('card-games', 5, 'Bridge', NULL, 0, NULL),
  ('card-games', 6, 'Whist', NULL, 0, NULL),
  ('card-games', 7, 'Patience', '["solitaire"]', 0, NULL),
  ('card-games', 8, 'Cribbage', '["crib"]', 0, NULL),
  ('card-games', 9, 'Go Fish', NULL, 0, NULL),
  ('card-games', 10, 'Crazy Eights', NULL, 0, NULL),
  ('card-games', 11, 'Hearts', NULL, 0, NULL),
  ('card-games', 12, 'Canasta', NULL, 0, NULL),
  ('card-games', 13, 'Baccarat', NULL, 0, NULL),
  ('card-games', 14, 'Cheat', NULL, 0, NULL),
  ('card-games', 15, 'Old Maid', NULL, 0, NULL),
  ('card-games', 16, 'Uno', NULL, 0, NULL);

-- ── Name 10 Summer Olympic sports
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('summer-olympic-sports', 'sport', 'Name 10 Summer Olympic sports', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('summer-olympic-sports', 1, 'Athletics', '["track and field"]', 0, NULL),
  ('summer-olympic-sports', 2, 'Swimming', NULL, 0, NULL),
  ('summer-olympic-sports', 3, 'Gymnastics', NULL, 0, NULL),
  ('summer-olympic-sports', 4, 'Rowing', NULL, 0, NULL),
  ('summer-olympic-sports', 5, 'Cycling', NULL, 0, NULL),
  ('summer-olympic-sports', 6, 'Boxing', NULL, 0, NULL),
  ('summer-olympic-sports', 7, 'Judo', NULL, 0, NULL),
  ('summer-olympic-sports', 8, 'Fencing', NULL, 0, NULL),
  ('summer-olympic-sports', 9, 'Archery', NULL, 0, NULL),
  ('summer-olympic-sports', 10, 'Diving', NULL, 0, NULL),
  ('summer-olympic-sports', 11, 'Sailing', NULL, 0, NULL),
  ('summer-olympic-sports', 12, 'Hockey', '["field hockey"]', 0, NULL),
  ('summer-olympic-sports', 13, 'Football', '["soccer"]', 0, NULL),
  ('summer-olympic-sports', 14, 'Tennis', NULL, 0, NULL),
  ('summer-olympic-sports', 15, 'Basketball', NULL, 0, NULL),
  ('summer-olympic-sports', 16, 'Equestrian', '["horse riding"]', 0, NULL),
  ('summer-olympic-sports', 17, 'Taekwondo', NULL, 0, NULL),
  ('summer-olympic-sports', 18, 'Weightlifting', NULL, 0, NULL),
  ('summer-olympic-sports', 19, 'Wrestling', NULL, 0, NULL),
  ('summer-olympic-sports', 20, 'Triathlon', NULL, 0, NULL),
  ('summer-olympic-sports', 21, 'Badminton', NULL, 0, NULL),
  ('summer-olympic-sports', 22, 'Golf', NULL, 0, NULL),
  ('summer-olympic-sports', 23, 'Surfing', NULL, 0, NULL),
  ('summer-olympic-sports', 24, 'Skateboarding', NULL, 0, NULL);

-- ── Name 10 Winter Olympic sports
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('winter-olympic-sports', 'sport', 'Name 10 Winter Olympic sports', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('winter-olympic-sports', 1, 'Alpine skiing', NULL, 0, NULL),
  ('winter-olympic-sports', 2, 'Snowboarding', NULL, 0, NULL),
  ('winter-olympic-sports', 3, 'Figure skating', NULL, 0, NULL),
  ('winter-olympic-sports', 4, 'Speed skating', NULL, 0, NULL),
  ('winter-olympic-sports', 5, 'Short track', '["short track speed skating"]', 0, NULL),
  ('winter-olympic-sports', 6, 'Ice hockey', NULL, 0, NULL),
  ('winter-olympic-sports', 7, 'Curling', NULL, 0, NULL),
  ('winter-olympic-sports', 8, 'Bobsleigh', '["bobsled"]', 0, NULL),
  ('winter-olympic-sports', 9, 'Luge', NULL, 0, NULL),
  ('winter-olympic-sports', 10, 'Skeleton', NULL, 0, NULL),
  ('winter-olympic-sports', 11, 'Biathlon', NULL, 0, NULL),
  ('winter-olympic-sports', 12, 'Ski jumping', NULL, 0, NULL),
  ('winter-olympic-sports', 13, 'Cross-country skiing', '["cross country skiing"]', 0, NULL),
  ('winter-olympic-sports', 14, 'Nordic combined', NULL, 0, NULL),
  ('winter-olympic-sports', 15, 'Freestyle skiing', NULL, 0, NULL);

-- ── Name 10 words that come before "board"
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('words-before-board', 'words', 'Name 10 words that come before "board"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('words-before-board', 1, 'Key', '["keyboard"]', 0, NULL),
  ('words-before-board', 2, 'Skate', '["skateboard"]', 0, NULL),
  ('words-before-board', 3, 'Surf', '["surfboard"]', 0, NULL),
  ('words-before-board', 4, 'Snow', '["snowboard"]', 0, NULL),
  ('words-before-board', 5, 'Black', '["blackboard"]', 0, NULL),
  ('words-before-board', 6, 'White', '["whiteboard"]', 0, NULL),
  ('words-before-board', 7, 'Card', '["cardboard"]', 0, NULL),
  ('words-before-board', 8, 'Cup', '["cupboard"]', 0, NULL),
  ('words-before-board', 9, 'Dash', '["dashboard"]', 0, NULL),
  ('words-before-board', 10, 'Chess', '["chessboard"]', 0, NULL),
  ('words-before-board', 11, 'Clip', '["clipboard"]', 0, NULL),
  ('words-before-board', 12, 'Dart', '["dartboard"]', 0, NULL),
  ('words-before-board', 13, 'Head', '["headboard"]', 0, NULL),
  ('words-before-board', 14, 'Mother', '["motherboard"]', 0, NULL),
  ('words-before-board', 15, 'Score', '["scoreboard"]', 0, NULL),
  ('words-before-board', 16, 'Sound', '["soundboard"]', 0, NULL),
  ('words-before-board', 17, 'Story', '["storyboard"]', 0, NULL),
  ('words-before-board', 18, 'Switch', '["switchboard"]', 0, NULL),
  ('words-before-board', 19, 'Floor', '["floorboard","floorboards"]', 0, NULL),
  ('words-before-board', 20, 'Bill', '["billboard"]', 0, NULL),
  ('words-before-board', 21, 'Ironing', '["ironing board"]', 0, NULL),
  ('words-before-board', 22, 'Chopping', '["chopping board"]', 0, NULL);

-- ── Name 10 words beginning with "sun"
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('words-beginning-sun', 'words', 'Name 10 words beginning with "sun"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('words-beginning-sun', 1, 'Sunflower', NULL, 0, NULL),
  ('words-beginning-sun', 2, 'Sunshine', NULL, 0, NULL),
  ('words-beginning-sun', 3, 'Sunset', NULL, 0, NULL),
  ('words-beginning-sun', 4, 'Sunrise', NULL, 0, NULL),
  ('words-beginning-sun', 5, 'Sunburn', NULL, 0, NULL),
  ('words-beginning-sun', 6, 'Sunglasses', NULL, 0, NULL),
  ('words-beginning-sun', 7, 'Sunbathe', NULL, 0, NULL),
  ('words-beginning-sun', 8, 'Sundial', NULL, 0, NULL),
  ('words-beginning-sun', 9, 'Sunscreen', NULL, 0, NULL),
  ('words-beginning-sun', 10, 'Sunbed', NULL, 0, NULL),
  ('words-beginning-sun', 11, 'Sunlight', NULL, 0, NULL),
  ('words-beginning-sun', 12, 'Sundown', NULL, 0, NULL),
  ('words-beginning-sun', 13, 'Sunroof', NULL, 0, NULL),
  ('words-beginning-sun', 14, 'Sunstroke', NULL, 0, NULL),
  ('words-beginning-sun', 15, 'Sunday', NULL, 0, NULL);

-- ── Name 10 fictional detectives
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('fictional-detectives', 'tv', 'Name 10 fictional detectives', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('fictional-detectives', 1, 'Sherlock Holmes', '["holmes","sherlock"]', 0, NULL),
  ('fictional-detectives', 2, 'Hercule Poirot', '["poirot"]', 0, NULL),
  ('fictional-detectives', 3, 'Miss Marple', '["marple","jane marple"]', 0, NULL),
  ('fictional-detectives', 4, 'Inspector Morse', '["morse","endeavour morse"]', 0, NULL),
  ('fictional-detectives', 5, 'Columbo', '["lieutenant columbo"]', 0, NULL),
  ('fictional-detectives', 6, 'Jessica Fletcher', '["fletcher"]', 0, NULL),
  ('fictional-detectives', 7, 'Father Brown', NULL, 0, NULL),
  ('fictional-detectives', 8, 'Nancy Drew', NULL, 0, NULL),
  ('fictional-detectives', 9, 'Philip Marlowe', '["marlowe"]', 0, NULL),
  ('fictional-detectives', 10, 'Rebus', '["john rebus","inspector rebus"]', 0, NULL),
  ('fictional-detectives', 11, 'Inspector Clouseau', '["clouseau","jacques clouseau"]', 0, NULL),
  ('fictional-detectives', 12, 'Inspector Lewis', '["lewis","robbie lewis"]', 0, NULL),
  ('fictional-detectives', 13, 'Vera', '["vera stanhope"]', 0, NULL),
  ('fictional-detectives', 14, 'Luther', '["john luther"]', 0, NULL),
  ('fictional-detectives', 15, 'Jack Frost', '["frost","inspector frost"]', 0, NULL),
  ('fictional-detectives', 16, 'Barnaby', '["tom barnaby","inspector barnaby"]', 0, NULL);

-- ── Name 10 Disney animated films
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('disney-animated-films', 'film', 'Name 10 Disney animated films', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('disney-animated-films', 1, 'Snow White', '["snow white and the seven dwarfs"]', 0, NULL),
  ('disney-animated-films', 2, 'Pinocchio', NULL, 0, NULL),
  ('disney-animated-films', 3, 'Dumbo', NULL, 0, NULL),
  ('disney-animated-films', 4, 'Bambi', NULL, 0, NULL),
  ('disney-animated-films', 5, 'Cinderella', NULL, 0, NULL),
  ('disney-animated-films', 6, 'Peter Pan', NULL, 0, NULL),
  ('disney-animated-films', 7, 'Sleeping Beauty', NULL, 0, NULL),
  ('disney-animated-films', 8, '101 Dalmatians', '["one hundred and one dalmatians","101 dalmations"]', 0, NULL),
  ('disney-animated-films', 9, 'The Jungle Book', NULL, 0, NULL),
  ('disney-animated-films', 10, 'The Little Mermaid', NULL, 0, NULL),
  ('disney-animated-films', 11, 'Beauty and the Beast', NULL, 0, NULL),
  ('disney-animated-films', 12, 'Aladdin', NULL, 0, NULL),
  ('disney-animated-films', 13, 'The Lion King', NULL, 0, NULL),
  ('disney-animated-films', 14, 'Mulan', NULL, 0, NULL),
  ('disney-animated-films', 15, 'Tarzan', NULL, 0, NULL),
  ('disney-animated-films', 16, 'Tangled', NULL, 0, NULL),
  ('disney-animated-films', 17, 'Frozen', NULL, 0, NULL),
  ('disney-animated-films', 18, 'Moana', NULL, 0, NULL),
  ('disney-animated-films', 19, 'Encanto', NULL, 0, NULL);

-- ── Name 10 gemstones
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('gemstones', 'nature', 'Name 10 gemstones', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('gemstones', 1, 'Diamond', NULL, 0, NULL),
  ('gemstones', 2, 'Ruby', NULL, 0, NULL),
  ('gemstones', 3, 'Sapphire', NULL, 0, NULL),
  ('gemstones', 4, 'Emerald', NULL, 0, NULL),
  ('gemstones', 5, 'Amethyst', NULL, 0, NULL),
  ('gemstones', 6, 'Topaz', NULL, 0, NULL),
  ('gemstones', 7, 'Opal', NULL, 0, NULL),
  ('gemstones', 8, 'Pearl', NULL, 0, NULL),
  ('gemstones', 9, 'Garnet', NULL, 0, NULL),
  ('gemstones', 10, 'Aquamarine', NULL, 0, NULL),
  ('gemstones', 11, 'Jade', NULL, 0, NULL),
  ('gemstones', 12, 'Turquoise', NULL, 0, NULL),
  ('gemstones', 13, 'Onyx', NULL, 0, NULL),
  ('gemstones', 14, 'Peridot', NULL, 0, NULL),
  ('gemstones', 15, 'Tanzanite', NULL, 0, NULL),
  ('gemstones', 16, 'Citrine', NULL, 0, NULL),
  ('gemstones', 17, 'Moonstone', NULL, 0, NULL);

-- ── Name 10 world currencies
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('world-currencies', 'money', 'Name 10 world currencies', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('world-currencies', 1, 'Pound', '["sterling","pound sterling"]', 0, NULL),
  ('world-currencies', 2, 'Euro', NULL, 0, NULL),
  ('world-currencies', 3, 'Dollar', NULL, 0, NULL),
  ('world-currencies', 4, 'Yen', NULL, 0, NULL),
  ('world-currencies', 5, 'Yuan', '["renminbi"]', 0, NULL),
  ('world-currencies', 6, 'Rupee', NULL, 0, NULL),
  ('world-currencies', 7, 'Rouble', '["ruble"]', 0, NULL),
  ('world-currencies', 8, 'Franc', NULL, 0, NULL),
  ('world-currencies', 9, 'Krona', NULL, 0, NULL),
  ('world-currencies', 10, 'Krone', NULL, 0, NULL),
  ('world-currencies', 11, 'Peso', NULL, 0, NULL),
  ('world-currencies', 12, 'Real', NULL, 0, NULL),
  ('world-currencies', 13, 'Rand', NULL, 0, NULL),
  ('world-currencies', 14, 'Won', NULL, 0, NULL),
  ('world-currencies', 15, 'Lira', NULL, 0, NULL),
  ('world-currencies', 16, 'Baht', NULL, 0, NULL),
  ('world-currencies', 17, 'Dirham', NULL, 0, NULL),
  ('world-currencies', 18, 'Zloty', NULL, 0, NULL),
  ('world-currencies', 19, 'Forint', NULL, 0, NULL),
  ('world-currencies', 20, 'Shekel', '["sheqel"]', 0, NULL);

-- ── Name 10 common UK garden birds
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('uk-garden-birds', 'nature', 'Name 10 common UK garden birds', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('uk-garden-birds', 1, 'Robin', NULL, 0, NULL),
  ('uk-garden-birds', 2, 'Blackbird', NULL, 0, NULL),
  ('uk-garden-birds', 3, 'Blue tit', NULL, 0, NULL),
  ('uk-garden-birds', 4, 'Great tit', NULL, 0, NULL),
  ('uk-garden-birds', 5, 'Sparrow', '["house sparrow"]', 0, NULL),
  ('uk-garden-birds', 6, 'Starling', NULL, 0, NULL),
  ('uk-garden-birds', 7, 'Wren', NULL, 0, NULL),
  ('uk-garden-birds', 8, 'Chaffinch', NULL, 0, NULL),
  ('uk-garden-birds', 9, 'Goldfinch', NULL, 0, NULL),
  ('uk-garden-birds', 10, 'Magpie', NULL, 0, NULL),
  ('uk-garden-birds', 11, 'Wood pigeon', '["woodpigeon"]', 0, NULL),
  ('uk-garden-birds', 12, 'Collared dove', NULL, 0, NULL),
  ('uk-garden-birds', 13, 'Song thrush', NULL, 0, NULL),
  ('uk-garden-birds', 14, 'Dunnock', NULL, 0, NULL),
  ('uk-garden-birds', 15, 'Jay', NULL, 0, NULL),
  ('uk-garden-birds', 16, 'Nuthatch', NULL, 0, NULL),
  ('uk-garden-birds', 17, 'Long-tailed tit', '["long tailed tit"]', 0, NULL);

-- ── Name 10 countries that have hosted the men's World Cup
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('world-cup-hosts', 'sport', 'Name 10 countries that have hosted the men''s World Cup', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('world-cup-hosts', 1, 'Uruguay', NULL, 0, NULL),
  ('world-cup-hosts', 2, 'Italy', NULL, 0, NULL),
  ('world-cup-hosts', 3, 'France', NULL, 0, NULL),
  ('world-cup-hosts', 4, 'Brazil', NULL, 0, NULL),
  ('world-cup-hosts', 5, 'Switzerland', NULL, 0, NULL),
  ('world-cup-hosts', 6, 'Sweden', NULL, 0, NULL),
  ('world-cup-hosts', 7, 'Chile', NULL, 0, NULL),
  ('world-cup-hosts', 8, 'England', NULL, 0, NULL),
  ('world-cup-hosts', 9, 'Mexico', NULL, 0, NULL),
  ('world-cup-hosts', 10, 'Germany', '["west germany"]', 0, NULL),
  ('world-cup-hosts', 11, 'Argentina', NULL, 0, NULL),
  ('world-cup-hosts', 12, 'Spain', NULL, 0, NULL),
  ('world-cup-hosts', 13, 'USA', '["united states","america"]', 0, NULL),
  ('world-cup-hosts', 14, 'South Korea', NULL, 0, NULL),
  ('world-cup-hosts', 15, 'Japan', NULL, 0, NULL),
  ('world-cup-hosts', 16, 'South Africa', NULL, 0, NULL),
  ('world-cup-hosts', 17, 'Russia', NULL, 0, NULL),
  ('world-cup-hosts', 18, 'Qatar', NULL, 0, NULL),
  ('world-cup-hosts', 19, 'Canada', NULL, 0, NULL);

-- ── Name 10 moons in our solar system
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('solar-system-moons', 'science', 'Name 10 moons in our solar system', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('solar-system-moons', 1, 'The Moon', '["moon","luna"]', 0, NULL),
  ('solar-system-moons', 2, 'Phobos', NULL, 0, NULL),
  ('solar-system-moons', 3, 'Deimos', NULL, 0, NULL),
  ('solar-system-moons', 4, 'Io', NULL, 0, NULL),
  ('solar-system-moons', 5, 'Europa', NULL, 0, NULL),
  ('solar-system-moons', 6, 'Ganymede', NULL, 0, NULL),
  ('solar-system-moons', 7, 'Callisto', NULL, 0, NULL),
  ('solar-system-moons', 8, 'Titan', NULL, 0, NULL),
  ('solar-system-moons', 9, 'Enceladus', NULL, 0, NULL),
  ('solar-system-moons', 10, 'Mimas', NULL, 0, NULL),
  ('solar-system-moons', 11, 'Rhea', NULL, 0, NULL),
  ('solar-system-moons', 12, 'Dione', NULL, 0, NULL),
  ('solar-system-moons', 13, 'Iapetus', NULL, 0, NULL),
  ('solar-system-moons', 14, 'Triton', NULL, 0, NULL),
  ('solar-system-moons', 15, 'Charon', NULL, 0, NULL),
  ('solar-system-moons', 16, 'Miranda', NULL, 0, NULL),
  ('solar-system-moons', 17, 'Titania', NULL, 0, NULL),
  ('solar-system-moons', 18, 'Oberon', NULL, 0, NULL);

-- ── Name 10 fast food chains in the UK
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('uk-fast-food-chains', 'food', 'Name 10 fast food chains in the UK', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('uk-fast-food-chains', 1, 'McDonald''s', '["mcdonalds","maccies","mcd"]', 0, NULL),
  ('uk-fast-food-chains', 2, 'Burger King', NULL, 0, NULL),
  ('uk-fast-food-chains', 3, 'KFC', '["kentucky fried chicken"]', 0, NULL),
  ('uk-fast-food-chains', 4, 'Subway', NULL, 0, NULL),
  ('uk-fast-food-chains', 5, 'Greggs', NULL, 0, NULL),
  ('uk-fast-food-chains', 6, 'Nando''s', '["nandos"]', 0, NULL),
  ('uk-fast-food-chains', 7, 'Domino''s', '["dominos"]', 0, NULL),
  ('uk-fast-food-chains', 8, 'Pizza Hut', NULL, 0, NULL),
  ('uk-fast-food-chains', 9, 'Five Guys', NULL, 0, NULL),
  ('uk-fast-food-chains', 10, 'Wendy''s', '["wendys"]', 0, NULL),
  ('uk-fast-food-chains', 11, 'Taco Bell', NULL, 0, NULL),
  ('uk-fast-food-chains', 12, 'Popeyes', NULL, 0, NULL),
  ('uk-fast-food-chains', 13, 'Leon', NULL, 0, NULL),
  ('uk-fast-food-chains', 14, 'Wimpy', NULL, 0, NULL),
  ('uk-fast-food-chains', 15, 'Papa John''s', '["papa johns"]', 0, NULL);

-- ── Name 10 dog breeds
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('dog-breeds', 'nature', 'Name 10 dog breeds', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('dog-breeds', 1, 'Labrador', '["lab","labrador retriever"]', 0, NULL),
  ('dog-breeds', 2, 'Poodle', NULL, 0, NULL),
  ('dog-breeds', 3, 'Beagle', NULL, 0, NULL),
  ('dog-breeds', 4, 'Boxer', NULL, 0, NULL),
  ('dog-breeds', 5, 'Dachshund', '["sausage dog"]', 0, NULL),
  ('dog-breeds', 6, 'Pug', NULL, 0, NULL),
  ('dog-breeds', 7, 'Chihuahua', NULL, 0, NULL),
  ('dog-breeds', 8, 'Rottweiler', NULL, 0, NULL),
  ('dog-breeds', 9, 'Dalmatian', '["dalmation"]', 0, NULL),
  ('dog-breeds', 10, 'Greyhound', NULL, 0, NULL),
  ('dog-breeds', 11, 'Border collie', '["collie"]', 0, NULL),
  ('dog-breeds', 12, 'Husky', '["siberian husky"]', 0, NULL),
  ('dog-breeds', 13, 'Bulldog', NULL, 0, NULL),
  ('dog-breeds', 14, 'Cocker spaniel', '["spaniel"]', 0, NULL),
  ('dog-breeds', 15, 'Jack Russell', NULL, 0, NULL),
  ('dog-breeds', 16, 'Great Dane', NULL, 0, NULL),
  ('dog-breeds', 17, 'Whippet', NULL, 0, NULL);

INSERT OR IGNORE INTO tenable_rounds (category, type, params, metric, title, answer_count)
SELECT 'general', 'general', '{"round":"' || r.slug || '"}', 'none', r.title,
       (SELECT COUNT(*) FROM general_answers a WHERE a.round_slug = r.slug)
FROM general_rounds r;
