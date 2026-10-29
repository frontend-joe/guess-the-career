-- Geography Tenable — the first ten rounds.
--
-- Content, not schema: these are the rounds to play from on day one, and the
-- admin section can add, edit and delete them from here on. They seed through a
-- migration rather than a script so a fresh database — a reviewer's, a test's,
-- production's on the next deploy — comes up with a playable Geography game
-- rather than an empty category nobody can tell is working.
--
-- Each round also gets its registry row in tenable_rounds, which is what the
-- rest of Tenable knows a round by: the multiplayer freeze reads that table,
-- and its params are how a round finds its answers back here.
--
-- INSERT OR IGNORE throughout, keyed on the slug, so re-seeding an edited round
-- never overwrites what an admin has since changed.

-- ── The 10 longest rivers in the world ──────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('rivers-longest', 'rivers', 'The 10 longest rivers in the world', 1, 'km');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('rivers-longest', 1, 'Nile', '["Nile River"]', 6650, '6,650'),
  ('rivers-longest', 2, 'Amazon', '["Amazon River"]', 6400, '6,400'),
  ('rivers-longest', 3, 'Yangtze', '["Chang Jiang","Yangtse"]', 6300, '6,300'),
  ('rivers-longest', 4, 'Mississippi–Missouri', '["Mississippi","Missouri","Mississippi-Missouri"]', 6275, '6,275'),
  ('rivers-longest', 5, 'Yenisei', '["Yenisey","Yenisei–Angara","Angara"]', 5539, '5,539'),
  ('rivers-longest', 6, 'Yellow River', '["Huang He","Hwang Ho","Yellow"]', 5464, '5,464'),
  ('rivers-longest', 7, 'Ob–Irtysh', '["Ob","Irtysh","Ob-Irtysh"]', 5410, '5,410'),
  ('rivers-longest', 8, 'Paraná', '["Parana"]', 4880, '4,880'),
  ('rivers-longest', 9, 'Congo', '["Zaire","Congo River"]', 4700, '4,700'),
  ('rivers-longest', 10, 'Amur', '["Amur–Argun","Heilong Jiang"]', 4444, '4,444');

-- ── The 10 highest mountains in the world ───────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('mountains-highest', 'mountains', 'The 10 highest mountains in the world', 1, 'm');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('mountains-highest', 1, 'Everest', '["Mount Everest","Sagarmatha","Chomolungma"]', 8849, '8,849'),
  ('mountains-highest', 2, 'K2', '["Mount Godwin-Austen","Godwin Austen","Qogir"]', 8611, '8,611'),
  ('mountains-highest', 3, 'Kangchenjunga', '["Kanchenjunga"]', 8586, '8,586'),
  ('mountains-highest', 4, 'Lhotse', NULL, 8516, '8,516'),
  ('mountains-highest', 5, 'Makalu', NULL, 8485, '8,485'),
  ('mountains-highest', 6, 'Cho Oyu', NULL, 8188, '8,188'),
  ('mountains-highest', 7, 'Dhaulagiri', '["Dhaulagiri I"]', 8167, '8,167'),
  ('mountains-highest', 8, 'Manaslu', NULL, 8163, '8,163'),
  ('mountains-highest', 9, 'Nanga Parbat', NULL, 8126, '8,126'),
  ('mountains-highest', 10, 'Annapurna', '["Annapurna I"]', 8091, '8,091');

-- ── The 10 largest countries by area ────────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-largest', 'countries', 'The 10 largest countries by area', 1, 'km²');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-largest', 1, 'Russia', '["Russian Federation"]', 17098246, '17.1m'),
  ('countries-largest', 2, 'Canada', NULL, 9984670, '9.98m'),
  ('countries-largest', 3, 'China', '["People''s Republic of China"]', 9596961, '9.60m'),
  ('countries-largest', 4, 'United States', '["USA","US","America","United States of America"]', 9525067, '9.53m'),
  ('countries-largest', 5, 'Brazil', NULL, 8515767, '8.52m'),
  ('countries-largest', 6, 'Australia', NULL, 7692024, '7.69m'),
  ('countries-largest', 7, 'India', NULL, 3287263, '3.29m'),
  ('countries-largest', 8, 'Argentina', NULL, 2780400, '2.78m'),
  ('countries-largest', 9, 'Kazakhstan', NULL, 2724900, '2.72m'),
  ('countries-largest', 10, 'Algeria', NULL, 2381741, '2.38m');

-- ── The 10 largest lakes in the world by area ───────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('lakes-largest', 'lakes', 'The 10 largest lakes in the world by area', 1, 'km²');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('lakes-largest', 1, 'Caspian Sea', '["Caspian"]', 371000, '371,000'),
  ('lakes-largest', 2, 'Lake Superior', '["Superior"]', 82100, '82,100'),
  ('lakes-largest', 3, 'Lake Victoria', '["Victoria"]', 68870, '68,870'),
  ('lakes-largest', 4, 'Lake Huron', '["Huron"]', 59600, '59,600'),
  ('lakes-largest', 5, 'Lake Michigan', '["Michigan"]', 58000, '58,000'),
  ('lakes-largest', 6, 'Lake Tanganyika', '["Tanganyika"]', 32900, '32,900'),
  ('lakes-largest', 7, 'Lake Baikal', '["Baikal"]', 31500, '31,500'),
  ('lakes-largest', 8, 'Great Bear Lake', '["Great Bear"]', 31000, '31,000'),
  ('lakes-largest', 9, 'Lake Malawi', '["Malawi","Lake Nyasa","Nyasa"]', 29500, '29,500'),
  ('lakes-largest', 10, 'Great Slave Lake', '["Great Slave"]', 28930, '28,930');

-- ── The 10 largest islands in the world ─────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('islands-largest', 'islands', 'The 10 largest islands in the world', 1, 'km²');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('islands-largest', 1, 'Greenland', NULL, 2130800, '2.13m'),
  ('islands-largest', 2, 'New Guinea', NULL, 785753, '785,753'),
  ('islands-largest', 3, 'Borneo', NULL, 748168, '748,168'),
  ('islands-largest', 4, 'Madagascar', NULL, 587041, '587,041'),
  ('islands-largest', 5, 'Baffin Island', '["Baffin"]', 507451, '507,451'),
  ('islands-largest', 6, 'Sumatra', NULL, 473481, '473,481'),
  ('islands-largest', 7, 'Honshu', NULL, 225800, '225,800'),
  ('islands-largest', 8, 'Victoria Island', NULL, 217291, '217,291'),
  ('islands-largest', 9, 'Great Britain', '["Britain"]', 209331, '209,331'),
  ('islands-largest', 10, 'Ellesmere Island', '["Ellesmere"]', 196236, '196,236');

-- ── The 10 most populated cities in the United States ───────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('us-cities-largest', 'cities', 'The 10 most populated cities in the United States', 1, 'people');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-cities-largest', 1, 'New York', '["New York City","NYC"]', 8258035, '8.26m'),
  ('us-cities-largest', 2, 'Los Angeles', '["LA"]', 3820914, '3.82m'),
  ('us-cities-largest', 3, 'Chicago', NULL, 2664452, '2.66m'),
  ('us-cities-largest', 4, 'Houston', NULL, 2314157, '2.31m'),
  ('us-cities-largest', 5, 'Phoenix', NULL, 1650070, '1.65m'),
  ('us-cities-largest', 6, 'Philadelphia', '["Philly"]', 1550542, '1.55m'),
  ('us-cities-largest', 7, 'San Antonio', NULL, 1495295, '1.50m'),
  ('us-cities-largest', 8, 'San Diego', NULL, 1388320, '1.39m'),
  ('us-cities-largest', 9, 'Dallas', NULL, 1302868, '1.30m'),
  ('us-cities-largest', 10, 'Jacksonville', NULL, 985843, '986k');

-- ── The 10 largest US states by area ────────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('us-states-largest', 'states', 'The 10 largest US states by area', 1, 'km²');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-states-largest', 1, 'Alaska', NULL, 1723337, '1.72m'),
  ('us-states-largest', 2, 'Texas', NULL, 695662, '695,662'),
  ('us-states-largest', 3, 'California', NULL, 423967, '423,967'),
  ('us-states-largest', 4, 'Montana', NULL, 380831, '380,831'),
  ('us-states-largest', 5, 'New Mexico', NULL, 314917, '314,917'),
  ('us-states-largest', 6, 'Arizona', NULL, 295234, '295,234'),
  ('us-states-largest', 7, 'Nevada', NULL, 286380, '286,380'),
  ('us-states-largest', 8, 'Colorado', NULL, 269601, '269,601'),
  ('us-states-largest', 9, 'Oregon', NULL, 254799, '254,799'),
  ('us-states-largest', 10, 'Wyoming', NULL, 253335, '253,335');

-- ── Name 10 countries beginning with S ──────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-s', 'countries', 'Name 10 countries beginning with S', 0, NULL);
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-s', 1, 'Samoa', NULL, 0, NULL),
  ('countries-s', 2, 'San Marino', NULL, 0, NULL),
  ('countries-s', 3, 'São Tomé and Príncipe', '["Sao Tome and Principe","Sao Tome"]', 0, NULL),
  ('countries-s', 4, 'Saudi Arabia', NULL, 0, NULL),
  ('countries-s', 5, 'Senegal', NULL, 0, NULL),
  ('countries-s', 6, 'Serbia', NULL, 0, NULL),
  ('countries-s', 7, 'Seychelles', NULL, 0, NULL),
  ('countries-s', 8, 'Sierra Leone', NULL, 0, NULL),
  ('countries-s', 9, 'Singapore', NULL, 0, NULL),
  ('countries-s', 10, 'Slovakia', NULL, 0, NULL),
  ('countries-s', 11, 'Slovenia', NULL, 0, NULL),
  ('countries-s', 12, 'Solomon Islands', NULL, 0, NULL),
  ('countries-s', 13, 'Somalia', NULL, 0, NULL),
  ('countries-s', 14, 'South Africa', NULL, 0, NULL),
  ('countries-s', 15, 'South Korea', '["Korea, South","Republic of Korea"]', 0, NULL),
  ('countries-s', 16, 'South Sudan', NULL, 0, NULL),
  ('countries-s', 17, 'Spain', NULL, 0, NULL),
  ('countries-s', 18, 'Sri Lanka', NULL, 0, NULL),
  ('countries-s', 19, 'Sudan', NULL, 0, NULL),
  ('countries-s', 20, 'Suriname', NULL, 0, NULL),
  ('countries-s', 21, 'Sweden', NULL, 0, NULL),
  ('countries-s', 22, 'Switzerland', NULL, 0, NULL),
  ('countries-s', 23, 'Syria', '["Syrian Arab Republic"]', 0, NULL),
  ('countries-s', 24, 'Saint Lucia', '["St Lucia","St. Lucia"]', 0, NULL),
  ('countries-s', 25, 'Saint Kitts and Nevis', '["St Kitts and Nevis","St Kitts"]', 0, NULL),
  ('countries-s', 26, 'Saint Vincent and the Grenadines', '["St Vincent and the Grenadines","St Vincent"]', 0, NULL);

-- ── Name 10 countries beginning with A ──────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-a', 'countries', 'Name 10 countries beginning with A', 0, NULL);
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-a', 1, 'Afghanistan', NULL, 0, NULL),
  ('countries-a', 2, 'Albania', NULL, 0, NULL),
  ('countries-a', 3, 'Algeria', NULL, 0, NULL),
  ('countries-a', 4, 'Andorra', NULL, 0, NULL),
  ('countries-a', 5, 'Angola', NULL, 0, NULL),
  ('countries-a', 6, 'Antigua and Barbuda', '["Antigua"]', 0, NULL),
  ('countries-a', 7, 'Argentina', NULL, 0, NULL),
  ('countries-a', 8, 'Armenia', NULL, 0, NULL),
  ('countries-a', 9, 'Australia', NULL, 0, NULL),
  ('countries-a', 10, 'Austria', NULL, 0, NULL),
  ('countries-a', 11, 'Azerbaijan', NULL, 0, NULL);

-- ── Name 10 landlocked countries in Europe ──────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-landlocked-europe', 'countries', 'Name 10 landlocked countries in Europe', 0, NULL);
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-landlocked-europe', 1, 'Andorra', NULL, 0, NULL),
  ('countries-landlocked-europe', 2, 'Austria', NULL, 0, NULL),
  ('countries-landlocked-europe', 3, 'Belarus', NULL, 0, NULL),
  ('countries-landlocked-europe', 4, 'Czechia', '["Czech Republic"]', 0, NULL),
  ('countries-landlocked-europe', 5, 'Hungary', NULL, 0, NULL),
  ('countries-landlocked-europe', 6, 'Kosovo', NULL, 0, NULL),
  ('countries-landlocked-europe', 7, 'Liechtenstein', NULL, 0, NULL),
  ('countries-landlocked-europe', 8, 'Luxembourg', NULL, 0, NULL),
  ('countries-landlocked-europe', 9, 'Moldova', NULL, 0, NULL),
  ('countries-landlocked-europe', 10, 'North Macedonia', '["Macedonia"]', 0, NULL),
  ('countries-landlocked-europe', 11, 'San Marino', NULL, 0, NULL),
  ('countries-landlocked-europe', 12, 'Serbia', NULL, 0, NULL),
  ('countries-landlocked-europe', 13, 'Slovakia', NULL, 0, NULL),
  ('countries-landlocked-europe', 14, 'Switzerland', NULL, 0, NULL),
  ('countries-landlocked-europe', 15, 'Vatican City', '["Vatican","Holy See"]', 0, NULL);

-- The registry rows. metric is 'none' because a geography round has no
-- metric to choose between — the answers carry their own numbers, and which
-- number it is is a property of the round, not of the question type.
INSERT OR IGNORE INTO tenable_rounds (category, type, params, metric, title, answer_count)
SELECT 'geography', 'geography', '{"round":"' || r.slug || '"}', 'none', r.title,
       (SELECT COUNT(*) FROM geography_answers a WHERE a.round_slug = r.slug)
FROM geography_rounds r;
