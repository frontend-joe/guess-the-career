-- Fifty-five rounds of geography and actors.
--
-- Two requests, and they pull in opposite directions. The geography rounds are
-- here because they are the ones players ask for: the answer is a fact, the
-- aliases are the other true name of a fixed thing (Burma is Myanmar), and the
-- host never has to adjudicate anything.
--
-- The actor rounds are a shape this category did not have: "name 10 actors
-- called David". The answer is a person's full name, but nobody in a room says
-- "David Thewlis" — they say "Thewlis". So every one of them carries its
-- surname as an alias, which is the first-name round's whole trick: the first
-- name is the question, so the surname is the answer.
--
-- Two deliberate choices in the actor rounds. Chris and Kate are "Chris or
-- Christopher" and "Kate or Katherine", because either alone is a pool of
-- twelve or thirteen and a pool that tight turns "name any ten" into "name
-- nearly all of them". And a handful of surnames are too famous on their own
-- to be an alias at all — Smith, Stone, Jackson — so those answers keep the
-- full name and alias the part that identifies them.
--
-- Pool sizes: the unordered rounds run from 12 to 28 answers for a board of
-- ten, and the six ranked rounds have exactly ten, matching every ranked round
-- before them.


-- ── Name 10 countries in Asia
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-asia', 'countries', 'Name 10 countries in Asia', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-asia', 1, 'China', NULL, 0, NULL),
  ('countries-asia', 2, 'India', NULL, 0, NULL),
  ('countries-asia', 3, 'Japan', NULL, 0, NULL),
  ('countries-asia', 4, 'South Korea', NULL, 0, NULL),
  ('countries-asia', 5, 'North Korea', NULL, 0, NULL),
  ('countries-asia', 6, 'Mongolia', NULL, 0, NULL),
  ('countries-asia', 7, 'Vietnam', NULL, 0, NULL),
  ('countries-asia', 8, 'Thailand', NULL, 0, NULL),
  ('countries-asia', 9, 'Cambodia', NULL, 0, NULL),
  ('countries-asia', 10, 'Laos', NULL, 0, NULL),
  ('countries-asia', 11, 'Myanmar', '["Burma"]', 0, NULL),
  ('countries-asia', 12, 'Malaysia', NULL, 0, NULL),
  ('countries-asia', 13, 'Singapore', NULL, 0, NULL),
  ('countries-asia', 14, 'Indonesia', NULL, 0, NULL),
  ('countries-asia', 15, 'Philippines', NULL, 0, NULL),
  ('countries-asia', 16, 'Nepal', NULL, 0, NULL),
  ('countries-asia', 17, 'Bhutan', NULL, 0, NULL),
  ('countries-asia', 18, 'Bangladesh', NULL, 0, NULL),
  ('countries-asia', 19, 'Pakistan', NULL, 0, NULL),
  ('countries-asia', 20, 'Sri Lanka', NULL, 0, NULL),
  ('countries-asia', 21, 'Afghanistan', NULL, 0, NULL),
  ('countries-asia', 22, 'Iran', NULL, 0, NULL),
  ('countries-asia', 23, 'Iraq', NULL, 0, NULL),
  ('countries-asia', 24, 'Saudi Arabia', NULL, 0, NULL),
  ('countries-asia', 25, 'Kazakhstan', NULL, 0, NULL),
  ('countries-asia', 26, 'Uzbekistan', NULL, 0, NULL);

-- ── Name 10 countries in Europe
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-europe', 'countries', 'Name 10 countries in Europe', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-europe', 1, 'France', NULL, 0, NULL),
  ('countries-europe', 2, 'Germany', NULL, 0, NULL),
  ('countries-europe', 3, 'Italy', NULL, 0, NULL),
  ('countries-europe', 4, 'Spain', NULL, 0, NULL),
  ('countries-europe', 5, 'Portugal', NULL, 0, NULL),
  ('countries-europe', 6, 'Belgium', NULL, 0, NULL),
  ('countries-europe', 7, 'Netherlands', '["Holland"]', 0, NULL),
  ('countries-europe', 8, 'Luxembourg', NULL, 0, NULL),
  ('countries-europe', 9, 'Switzerland', NULL, 0, NULL),
  ('countries-europe', 10, 'Austria', NULL, 0, NULL),
  ('countries-europe', 11, 'Denmark', NULL, 0, NULL),
  ('countries-europe', 12, 'Sweden', NULL, 0, NULL),
  ('countries-europe', 13, 'Norway', NULL, 0, NULL),
  ('countries-europe', 14, 'Finland', NULL, 0, NULL),
  ('countries-europe', 15, 'Poland', NULL, 0, NULL),
  ('countries-europe', 16, 'Czechia', '["Czech Republic"]', 0, NULL),
  ('countries-europe', 17, 'Slovakia', NULL, 0, NULL),
  ('countries-europe', 18, 'Hungary', NULL, 0, NULL),
  ('countries-europe', 19, 'Romania', NULL, 0, NULL),
  ('countries-europe', 20, 'Bulgaria', NULL, 0, NULL),
  ('countries-europe', 21, 'Greece', NULL, 0, NULL),
  ('countries-europe', 22, 'Croatia', NULL, 0, NULL),
  ('countries-europe', 23, 'Slovenia', NULL, 0, NULL),
  ('countries-europe', 24, 'Serbia', NULL, 0, NULL),
  ('countries-europe', 25, 'Ireland', NULL, 0, NULL);

-- ── Name 10 countries in Africa
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-africa', 'countries', 'Name 10 countries in Africa', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-africa', 1, 'Egypt', NULL, 0, NULL),
  ('countries-africa', 2, 'Morocco', NULL, 0, NULL),
  ('countries-africa', 3, 'Algeria', NULL, 0, NULL),
  ('countries-africa', 4, 'Tunisia', NULL, 0, NULL),
  ('countries-africa', 5, 'Libya', NULL, 0, NULL),
  ('countries-africa', 6, 'Nigeria', NULL, 0, NULL),
  ('countries-africa', 7, 'Ghana', NULL, 0, NULL),
  ('countries-africa', 8, 'Senegal', NULL, 0, NULL),
  ('countries-africa', 9, 'Mali', NULL, 0, NULL),
  ('countries-africa', 10, 'Kenya', NULL, 0, NULL),
  ('countries-africa', 11, 'Tanzania', NULL, 0, NULL),
  ('countries-africa', 12, 'Uganda', NULL, 0, NULL),
  ('countries-africa', 13, 'Ethiopia', NULL, 0, NULL),
  ('countries-africa', 14, 'Somalia', NULL, 0, NULL),
  ('countries-africa', 15, 'Sudan', NULL, 0, NULL),
  ('countries-africa', 16, 'South Africa', NULL, 0, NULL),
  ('countries-africa', 17, 'Zimbabwe', NULL, 0, NULL),
  ('countries-africa', 18, 'Botswana', NULL, 0, NULL),
  ('countries-africa', 19, 'Mozambique', NULL, 0, NULL),
  ('countries-africa', 20, 'Angola', NULL, 0, NULL),
  ('countries-africa', 21, 'Cameroon', NULL, 0, NULL),
  ('countries-africa', 22, 'Ivory Coast', '["Cote d Ivoire"]', 0, NULL),
  ('countries-africa', 23, 'Rwanda', NULL, 0, NULL),
  ('countries-africa', 24, 'Madagascar', NULL, 0, NULL);

-- ── Name 10 countries in the Caribbean
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-caribbean', 'countries', 'Name 10 countries in the Caribbean', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-caribbean', 1, 'Cuba', NULL, 0, NULL),
  ('countries-caribbean', 2, 'Jamaica', NULL, 0, NULL),
  ('countries-caribbean', 3, 'Haiti', NULL, 0, NULL),
  ('countries-caribbean', 4, 'Dominican Republic', '["Dominican Rep"]', 0, NULL),
  ('countries-caribbean', 5, 'Bahamas', NULL, 0, NULL),
  ('countries-caribbean', 6, 'Barbados', NULL, 0, NULL),
  ('countries-caribbean', 7, 'Trinidad and Tobago', '["Trinidad"]', 0, NULL),
  ('countries-caribbean', 8, 'Saint Lucia', '["St Lucia"]', 0, NULL),
  ('countries-caribbean', 9, 'Grenada', NULL, 0, NULL),
  ('countries-caribbean', 10, 'Antigua and Barbuda', '["Antigua"]', 0, NULL),
  ('countries-caribbean', 11, 'Saint Vincent and the Grenadines', '["St Vincent"]', 0, NULL),
  ('countries-caribbean', 12, 'Dominica', NULL, 0, NULL),
  ('countries-caribbean', 13, 'Saint Kitts and Nevis', '["St Kitts"]', 0, NULL);

-- ── Name 10 countries in Oceania
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-oceania', 'countries', 'Name 10 countries in Oceania', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-oceania', 1, 'Australia', NULL, 0, NULL),
  ('countries-oceania', 2, 'New Zealand', NULL, 0, NULL),
  ('countries-oceania', 3, 'Papua New Guinea', NULL, 0, NULL),
  ('countries-oceania', 4, 'Fiji', NULL, 0, NULL),
  ('countries-oceania', 5, 'Samoa', NULL, 0, NULL),
  ('countries-oceania', 6, 'Tonga', NULL, 0, NULL),
  ('countries-oceania', 7, 'Vanuatu', NULL, 0, NULL),
  ('countries-oceania', 8, 'Solomon Islands', NULL, 0, NULL),
  ('countries-oceania', 9, 'Kiribati', NULL, 0, NULL),
  ('countries-oceania', 10, 'Tuvalu', NULL, 0, NULL),
  ('countries-oceania', 11, 'Nauru', NULL, 0, NULL),
  ('countries-oceania', 12, 'Palau', NULL, 0, NULL),
  ('countries-oceania', 13, 'Micronesia', NULL, 0, NULL),
  ('countries-oceania', 14, 'Marshall Islands', NULL, 0, NULL);

-- ── Name 10 island countries
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-island', 'countries', 'Name 10 island countries', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-island', 1, 'Japan', NULL, 0, NULL),
  ('countries-island', 2, 'Iceland', NULL, 0, NULL),
  ('countries-island', 3, 'Madagascar', NULL, 0, NULL),
  ('countries-island', 4, 'Sri Lanka', NULL, 0, NULL),
  ('countries-island', 5, 'Cuba', NULL, 0, NULL),
  ('countries-island', 6, 'Jamaica', NULL, 0, NULL),
  ('countries-island', 7, 'New Zealand', NULL, 0, NULL),
  ('countries-island', 8, 'Philippines', NULL, 0, NULL),
  ('countries-island', 9, 'Indonesia', NULL, 0, NULL),
  ('countries-island', 10, 'Malta', NULL, 0, NULL),
  ('countries-island', 11, 'Cyprus', NULL, 0, NULL),
  ('countries-island', 12, 'Fiji', NULL, 0, NULL),
  ('countries-island', 13, 'Maldives', NULL, 0, NULL),
  ('countries-island', 14, 'Mauritius', NULL, 0, NULL),
  ('countries-island', 15, 'Seychelles', NULL, 0, NULL),
  ('countries-island', 16, 'Bahrain', NULL, 0, NULL),
  ('countries-island', 17, 'Singapore', NULL, 0, NULL),
  ('countries-island', 18, 'Taiwan', NULL, 0, NULL),
  ('countries-island', 19, 'Papua New Guinea', NULL, 0, NULL),
  ('countries-island', 20, 'Comoros', NULL, 0, NULL);

-- ── Name 10 countries in the southern hemisphere
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-southern-hemisphere', 'countries', 'Name 10 countries in the southern hemisphere', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-southern-hemisphere', 1, 'Australia', NULL, 0, NULL),
  ('countries-southern-hemisphere', 2, 'New Zealand', NULL, 0, NULL),
  ('countries-southern-hemisphere', 3, 'Argentina', NULL, 0, NULL),
  ('countries-southern-hemisphere', 4, 'Brazil', NULL, 0, NULL),
  ('countries-southern-hemisphere', 5, 'Chile', NULL, 0, NULL),
  ('countries-southern-hemisphere', 6, 'Peru', NULL, 0, NULL),
  ('countries-southern-hemisphere', 7, 'Bolivia', NULL, 0, NULL),
  ('countries-southern-hemisphere', 8, 'Paraguay', NULL, 0, NULL),
  ('countries-southern-hemisphere', 9, 'Uruguay', NULL, 0, NULL),
  ('countries-southern-hemisphere', 10, 'South Africa', NULL, 0, NULL),
  ('countries-southern-hemisphere', 11, 'Zimbabwe', NULL, 0, NULL),
  ('countries-southern-hemisphere', 12, 'Zambia', NULL, 0, NULL),
  ('countries-southern-hemisphere', 13, 'Botswana', NULL, 0, NULL),
  ('countries-southern-hemisphere', 14, 'Namibia', NULL, 0, NULL),
  ('countries-southern-hemisphere', 15, 'Mozambique', NULL, 0, NULL),
  ('countries-southern-hemisphere', 16, 'Angola', NULL, 0, NULL),
  ('countries-southern-hemisphere', 17, 'Madagascar', NULL, 0, NULL),
  ('countries-southern-hemisphere', 18, 'Tanzania', NULL, 0, NULL),
  ('countries-southern-hemisphere', 19, 'Fiji', NULL, 0, NULL),
  ('countries-southern-hemisphere', 20, 'Papua New Guinea', NULL, 0, NULL);

-- ── Name 10 Commonwealth countries
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-commonwealth', 'countries', 'Name 10 Commonwealth countries', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-commonwealth', 1, 'United Kingdom', '["UK", "Britain"]', 0, NULL),
  ('countries-commonwealth', 2, 'Canada', NULL, 0, NULL),
  ('countries-commonwealth', 3, 'Australia', NULL, 0, NULL),
  ('countries-commonwealth', 4, 'New Zealand', NULL, 0, NULL),
  ('countries-commonwealth', 5, 'India', NULL, 0, NULL),
  ('countries-commonwealth', 6, 'Pakistan', NULL, 0, NULL),
  ('countries-commonwealth', 7, 'Bangladesh', NULL, 0, NULL),
  ('countries-commonwealth', 8, 'Sri Lanka', NULL, 0, NULL),
  ('countries-commonwealth', 9, 'Malaysia', NULL, 0, NULL),
  ('countries-commonwealth', 10, 'Singapore', NULL, 0, NULL),
  ('countries-commonwealth', 11, 'Nigeria', NULL, 0, NULL),
  ('countries-commonwealth', 12, 'Ghana', NULL, 0, NULL),
  ('countries-commonwealth', 13, 'Kenya', NULL, 0, NULL),
  ('countries-commonwealth', 14, 'Uganda', NULL, 0, NULL),
  ('countries-commonwealth', 15, 'Tanzania', NULL, 0, NULL),
  ('countries-commonwealth', 16, 'South Africa', NULL, 0, NULL),
  ('countries-commonwealth', 17, 'Zambia', NULL, 0, NULL),
  ('countries-commonwealth', 18, 'Malawi', NULL, 0, NULL),
  ('countries-commonwealth', 19, 'Jamaica', NULL, 0, NULL),
  ('countries-commonwealth', 20, 'Barbados', NULL, 0, NULL),
  ('countries-commonwealth', 21, 'Trinidad and Tobago', '["Trinidad"]', 0, NULL),
  ('countries-commonwealth', 22, 'Cyprus', NULL, 0, NULL),
  ('countries-commonwealth', 23, 'Malta', NULL, 0, NULL),
  ('countries-commonwealth', 24, 'Fiji', NULL, 0, NULL);

-- ── Name 10 countries the Equator passes through
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-equator', 'countries', 'Name 10 countries the Equator passes through', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-equator', 1, 'Ecuador', NULL, 0, NULL),
  ('countries-equator', 2, 'Colombia', NULL, 0, NULL),
  ('countries-equator', 3, 'Brazil', NULL, 0, NULL),
  ('countries-equator', 4, 'Gabon', NULL, 0, NULL),
  ('countries-equator', 5, 'Uganda', NULL, 0, NULL),
  ('countries-equator', 6, 'Kenya', NULL, 0, NULL),
  ('countries-equator', 7, 'Somalia', NULL, 0, NULL),
  ('countries-equator', 8, 'Indonesia', NULL, 0, NULL),
  ('countries-equator', 9, 'Kiribati', NULL, 0, NULL),
  ('countries-equator', 10, 'Maldives', NULL, 0, NULL),
  ('countries-equator', 11, 'Sao Tome and Principe', '["Sao Tome"]', 0, NULL),
  ('countries-equator', 12, 'DR Congo', '["Democratic Republic of the Congo", "Congo"]', 0, NULL);

-- ── Name 10 landlocked countries in Asia
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-landlocked-asia', 'countries', 'Name 10 landlocked countries in Asia', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-landlocked-asia', 1, 'Kazakhstan', NULL, 0, NULL),
  ('countries-landlocked-asia', 2, 'Uzbekistan', NULL, 0, NULL),
  ('countries-landlocked-asia', 3, 'Turkmenistan', NULL, 0, NULL),
  ('countries-landlocked-asia', 4, 'Kyrgyzstan', NULL, 0, NULL),
  ('countries-landlocked-asia', 5, 'Tajikistan', NULL, 0, NULL),
  ('countries-landlocked-asia', 6, 'Afghanistan', NULL, 0, NULL),
  ('countries-landlocked-asia', 7, 'Mongolia', NULL, 0, NULL),
  ('countries-landlocked-asia', 8, 'Nepal', NULL, 0, NULL),
  ('countries-landlocked-asia', 9, 'Bhutan', NULL, 0, NULL),
  ('countries-landlocked-asia', 10, 'Laos', NULL, 0, NULL),
  ('countries-landlocked-asia', 11, 'Armenia', NULL, 0, NULL),
  ('countries-landlocked-asia', 12, 'Azerbaijan', NULL, 0, NULL);

-- ── Name 10 countries bordering Russia
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-bordering-russia', 'countries', 'Name 10 countries bordering Russia', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-bordering-russia', 1, 'Norway', NULL, 0, NULL),
  ('countries-bordering-russia', 2, 'Finland', NULL, 0, NULL),
  ('countries-bordering-russia', 3, 'Estonia', NULL, 0, NULL),
  ('countries-bordering-russia', 4, 'Latvia', NULL, 0, NULL),
  ('countries-bordering-russia', 5, 'Lithuania', NULL, 0, NULL),
  ('countries-bordering-russia', 6, 'Poland', NULL, 0, NULL),
  ('countries-bordering-russia', 7, 'Belarus', NULL, 0, NULL),
  ('countries-bordering-russia', 8, 'Ukraine', NULL, 0, NULL),
  ('countries-bordering-russia', 9, 'Georgia', NULL, 0, NULL),
  ('countries-bordering-russia', 10, 'Azerbaijan', NULL, 0, NULL),
  ('countries-bordering-russia', 11, 'Kazakhstan', NULL, 0, NULL),
  ('countries-bordering-russia', 12, 'Mongolia', NULL, 0, NULL),
  ('countries-bordering-russia', 13, 'China', NULL, 0, NULL),
  ('countries-bordering-russia', 14, 'North Korea', NULL, 0, NULL);

-- ── Name 10 countries beginning with M
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-m', 'countries', 'Name 10 countries beginning with M', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-m', 1, 'Madagascar', NULL, 0, NULL),
  ('countries-m', 2, 'Malawi', NULL, 0, NULL),
  ('countries-m', 3, 'Malaysia', NULL, 0, NULL),
  ('countries-m', 4, 'Maldives', NULL, 0, NULL),
  ('countries-m', 5, 'Mali', NULL, 0, NULL),
  ('countries-m', 6, 'Malta', NULL, 0, NULL),
  ('countries-m', 7, 'Marshall Islands', NULL, 0, NULL),
  ('countries-m', 8, 'Mauritania', NULL, 0, NULL),
  ('countries-m', 9, 'Mauritius', NULL, 0, NULL),
  ('countries-m', 10, 'Mexico', NULL, 0, NULL),
  ('countries-m', 11, 'Micronesia', NULL, 0, NULL),
  ('countries-m', 12, 'Moldova', NULL, 0, NULL),
  ('countries-m', 13, 'Monaco', NULL, 0, NULL),
  ('countries-m', 14, 'Mongolia', NULL, 0, NULL),
  ('countries-m', 15, 'Montenegro', NULL, 0, NULL),
  ('countries-m', 16, 'Morocco', NULL, 0, NULL),
  ('countries-m', 17, 'Mozambique', NULL, 0, NULL),
  ('countries-m', 18, 'Myanmar', '["Burma"]', 0, NULL);

-- ── Name 10 countries beginning with T
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-t', 'countries', 'Name 10 countries beginning with T', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-t', 1, 'Taiwan', NULL, 0, NULL),
  ('countries-t', 2, 'Tajikistan', NULL, 0, NULL),
  ('countries-t', 3, 'Tanzania', NULL, 0, NULL),
  ('countries-t', 4, 'Thailand', NULL, 0, NULL),
  ('countries-t', 5, 'Timor-Leste', '["East Timor"]', 0, NULL),
  ('countries-t', 6, 'Togo', NULL, 0, NULL),
  ('countries-t', 7, 'Tonga', NULL, 0, NULL),
  ('countries-t', 8, 'Trinidad and Tobago', '["Trinidad"]', 0, NULL),
  ('countries-t', 9, 'Tunisia', NULL, 0, NULL),
  ('countries-t', 10, 'Turkey', '["Turkiye"]', 0, NULL),
  ('countries-t', 11, 'Turkmenistan', NULL, 0, NULL),
  ('countries-t', 12, 'Tuvalu', NULL, 0, NULL);

-- ── Name 10 capital cities beginning with M
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('capitals-m', 'capitals', 'Name 10 capital cities beginning with M', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('capitals-m', 1, 'Madrid', NULL, 0, NULL),
  ('capitals-m', 2, 'Managua', NULL, 0, NULL),
  ('capitals-m', 3, 'Manama', NULL, 0, NULL),
  ('capitals-m', 4, 'Manila', NULL, 0, NULL),
  ('capitals-m', 5, 'Maputo', NULL, 0, NULL),
  ('capitals-m', 6, 'Maseru', NULL, 0, NULL),
  ('capitals-m', 7, 'Mbabane', NULL, 0, NULL),
  ('capitals-m', 8, 'Mexico City', NULL, 0, NULL),
  ('capitals-m', 9, 'Minsk', NULL, 0, NULL),
  ('capitals-m', 10, 'Mogadishu', NULL, 0, NULL),
  ('capitals-m', 11, 'Monaco', NULL, 0, NULL),
  ('capitals-m', 12, 'Monrovia', NULL, 0, NULL),
  ('capitals-m', 13, 'Montevideo', NULL, 0, NULL),
  ('capitals-m', 14, 'Moroni', NULL, 0, NULL),
  ('capitals-m', 15, 'Moscow', NULL, 0, NULL),
  ('capitals-m', 16, 'Muscat', NULL, 0, NULL);

-- ── Name 10 capital cities in Africa
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('capitals-africa', 'capitals', 'Name 10 capital cities in Africa', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('capitals-africa', 1, 'Cairo', NULL, 0, NULL),
  ('capitals-africa', 2, 'Rabat', NULL, 0, NULL),
  ('capitals-africa', 3, 'Algiers', NULL, 0, NULL),
  ('capitals-africa', 4, 'Tunis', NULL, 0, NULL),
  ('capitals-africa', 5, 'Tripoli', NULL, 0, NULL),
  ('capitals-africa', 6, 'Abuja', NULL, 0, NULL),
  ('capitals-africa', 7, 'Accra', NULL, 0, NULL),
  ('capitals-africa', 8, 'Dakar', NULL, 0, NULL),
  ('capitals-africa', 9, 'Bamako', NULL, 0, NULL),
  ('capitals-africa', 10, 'Nairobi', NULL, 0, NULL),
  ('capitals-africa', 11, 'Dodoma', NULL, 0, NULL),
  ('capitals-africa', 12, 'Kampala', NULL, 0, NULL),
  ('capitals-africa', 13, 'Addis Ababa', NULL, 0, NULL),
  ('capitals-africa', 14, 'Mogadishu', NULL, 0, NULL),
  ('capitals-africa', 15, 'Khartoum', NULL, 0, NULL),
  ('capitals-africa', 16, 'Pretoria', NULL, 0, NULL),
  ('capitals-africa', 17, 'Harare', NULL, 0, NULL),
  ('capitals-africa', 18, 'Lusaka', NULL, 0, NULL),
  ('capitals-africa', 19, 'Gaborone', NULL, 0, NULL),
  ('capitals-africa', 20, 'Windhoek', NULL, 0, NULL),
  ('capitals-africa', 21, 'Maputo', NULL, 0, NULL),
  ('capitals-africa', 22, 'Luanda', NULL, 0, NULL),
  ('capitals-africa', 23, 'Kigali', NULL, 0, NULL),
  ('capitals-africa', 24, 'Antananarivo', NULL, 0, NULL);

-- ── Name 10 capital cities in South America
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('capitals-south-america', 'capitals', 'Name 10 capital cities in South America', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('capitals-south-america', 1, 'Buenos Aires', NULL, 0, NULL),
  ('capitals-south-america', 2, 'Brasilia', NULL, 0, NULL),
  ('capitals-south-america', 3, 'Santiago', NULL, 0, NULL),
  ('capitals-south-america', 4, 'Lima', NULL, 0, NULL),
  ('capitals-south-america', 5, 'Quito', NULL, 0, NULL),
  ('capitals-south-america', 6, 'Bogota', NULL, 0, NULL),
  ('capitals-south-america', 7, 'Caracas', NULL, 0, NULL),
  ('capitals-south-america', 8, 'La Paz', NULL, 0, NULL),
  ('capitals-south-america', 9, 'Sucre', NULL, 0, NULL),
  ('capitals-south-america', 10, 'Asuncion', NULL, 0, NULL),
  ('capitals-south-america', 11, 'Montevideo', NULL, 0, NULL),
  ('capitals-south-america', 12, 'Georgetown', NULL, 0, NULL),
  ('capitals-south-america', 13, 'Paramaribo', NULL, 0, NULL);

-- ── Name 10 US state capitals
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-state-capitals', 'capitals', 'Name 10 US state capitals', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-state-capitals', 1, 'Albany', NULL, 0, NULL),
  ('us-state-capitals', 2, 'Atlanta', NULL, 0, NULL),
  ('us-state-capitals', 3, 'Austin', NULL, 0, NULL),
  ('us-state-capitals', 4, 'Boston', NULL, 0, NULL),
  ('us-state-capitals', 5, 'Denver', NULL, 0, NULL),
  ('us-state-capitals', 6, 'Honolulu', NULL, 0, NULL),
  ('us-state-capitals', 7, 'Nashville', NULL, 0, NULL),
  ('us-state-capitals', 8, 'Phoenix', NULL, 0, NULL),
  ('us-state-capitals', 9, 'Sacramento', NULL, 0, NULL),
  ('us-state-capitals', 10, 'Salt Lake City', NULL, 0, NULL),
  ('us-state-capitals', 11, 'Springfield', NULL, 0, NULL),
  ('us-state-capitals', 12, 'Columbus', NULL, 0, NULL),
  ('us-state-capitals', 13, 'Indianapolis', NULL, 0, NULL),
  ('us-state-capitals', 14, 'Des Moines', NULL, 0, NULL),
  ('us-state-capitals', 15, 'Topeka', NULL, 0, NULL),
  ('us-state-capitals', 16, 'Lincoln', NULL, 0, NULL),
  ('us-state-capitals', 17, 'Boise', NULL, 0, NULL),
  ('us-state-capitals', 18, 'Helena', NULL, 0, NULL),
  ('us-state-capitals', 19, 'Olympia', NULL, 0, NULL),
  ('us-state-capitals', 20, 'Juneau', NULL, 0, NULL),
  ('us-state-capitals', 21, 'Tallahassee', NULL, 0, NULL),
  ('us-state-capitals', 22, 'Richmond', NULL, 0, NULL),
  ('us-state-capitals', 23, 'Annapolis', NULL, 0, NULL),
  ('us-state-capitals', 24, 'Harrisburg', NULL, 0, NULL),
  ('us-state-capitals', 25, 'Trenton', NULL, 0, NULL),
  ('us-state-capitals', 26, 'Madison', NULL, 0, NULL),
  ('us-state-capitals', 27, 'Lansing', NULL, 0, NULL),
  ('us-state-capitals', 28, 'Raleigh', NULL, 0, NULL);

-- ── Name 10 US states bordering Canada
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-states-bordering-canada', 'states', 'Name 10 US states bordering Canada', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-states-bordering-canada', 1, 'Alaska', NULL, 0, NULL),
  ('us-states-bordering-canada', 2, 'Washington', NULL, 0, NULL),
  ('us-states-bordering-canada', 3, 'Idaho', NULL, 0, NULL),
  ('us-states-bordering-canada', 4, 'Montana', NULL, 0, NULL),
  ('us-states-bordering-canada', 5, 'North Dakota', NULL, 0, NULL),
  ('us-states-bordering-canada', 6, 'Minnesota', NULL, 0, NULL),
  ('us-states-bordering-canada', 7, 'Michigan', NULL, 0, NULL),
  ('us-states-bordering-canada', 8, 'Ohio', NULL, 0, NULL),
  ('us-states-bordering-canada', 9, 'Pennsylvania', NULL, 0, NULL),
  ('us-states-bordering-canada', 10, 'New York', NULL, 0, NULL),
  ('us-states-bordering-canada', 11, 'Vermont', NULL, 0, NULL),
  ('us-states-bordering-canada', 12, 'New Hampshire', NULL, 0, NULL),
  ('us-states-bordering-canada', 13, 'Maine', NULL, 0, NULL);

-- ── Name 10 UK cities
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('uk-cities', 'cities', 'Name 10 UK cities', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('uk-cities', 1, 'London', NULL, 0, NULL),
  ('uk-cities', 2, 'Birmingham', NULL, 0, NULL),
  ('uk-cities', 3, 'Manchester', NULL, 0, NULL),
  ('uk-cities', 4, 'Liverpool', NULL, 0, NULL),
  ('uk-cities', 5, 'Leeds', NULL, 0, NULL),
  ('uk-cities', 6, 'Sheffield', NULL, 0, NULL),
  ('uk-cities', 7, 'Bristol', NULL, 0, NULL),
  ('uk-cities', 8, 'Newcastle upon Tyne', '["Newcastle"]', 0, NULL),
  ('uk-cities', 9, 'Nottingham', NULL, 0, NULL),
  ('uk-cities', 10, 'Leicester', NULL, 0, NULL),
  ('uk-cities', 11, 'Coventry', NULL, 0, NULL),
  ('uk-cities', 12, 'Bradford', NULL, 0, NULL),
  ('uk-cities', 13, 'Cardiff', NULL, 0, NULL),
  ('uk-cities', 14, 'Swansea', NULL, 0, NULL),
  ('uk-cities', 15, 'Edinburgh', NULL, 0, NULL),
  ('uk-cities', 16, 'Glasgow', NULL, 0, NULL),
  ('uk-cities', 17, 'Aberdeen', NULL, 0, NULL),
  ('uk-cities', 18, 'Dundee', NULL, 0, NULL),
  ('uk-cities', 19, 'Belfast', NULL, 0, NULL),
  ('uk-cities', 20, 'Derry', '["Londonderry"]', 0, NULL),
  ('uk-cities', 21, 'York', NULL, 0, NULL),
  ('uk-cities', 22, 'Bath', NULL, 0, NULL),
  ('uk-cities', 23, 'Oxford', NULL, 0, NULL),
  ('uk-cities', 24, 'Cambridge', NULL, 0, NULL),
  ('uk-cities', 25, 'Durham', NULL, 0, NULL),
  ('uk-cities', 26, 'Norwich', NULL, 0, NULL),
  ('uk-cities', 27, 'Plymouth', NULL, 0, NULL),
  ('uk-cities', 28, 'Southampton', NULL, 0, NULL);

-- ── Name 10 English counties
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('english-counties', 'places', 'Name 10 English counties', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('english-counties', 1, 'Yorkshire', NULL, 0, NULL),
  ('english-counties', 2, 'Lancashire', NULL, 0, NULL),
  ('english-counties', 3, 'Cheshire', NULL, 0, NULL),
  ('english-counties', 4, 'Devon', NULL, 0, NULL),
  ('english-counties', 5, 'Cornwall', NULL, 0, NULL),
  ('english-counties', 6, 'Somerset', NULL, 0, NULL),
  ('english-counties', 7, 'Dorset', NULL, 0, NULL),
  ('english-counties', 8, 'Kent', NULL, 0, NULL),
  ('english-counties', 9, 'Surrey', NULL, 0, NULL),
  ('english-counties', 10, 'Sussex', NULL, 0, NULL),
  ('english-counties', 11, 'Essex', NULL, 0, NULL),
  ('english-counties', 12, 'Norfolk', NULL, 0, NULL),
  ('english-counties', 13, 'Suffolk', NULL, 0, NULL),
  ('english-counties', 14, 'Hampshire', NULL, 0, NULL),
  ('english-counties', 15, 'Wiltshire', NULL, 0, NULL),
  ('english-counties', 16, 'Gloucestershire', NULL, 0, NULL),
  ('english-counties', 17, 'Shropshire', NULL, 0, NULL),
  ('english-counties', 18, 'Staffordshire', NULL, 0, NULL),
  ('english-counties', 19, 'Derbyshire', NULL, 0, NULL),
  ('english-counties', 20, 'Nottinghamshire', NULL, 0, NULL),
  ('english-counties', 21, 'Lincolnshire', NULL, 0, NULL),
  ('english-counties', 22, 'Northumberland', NULL, 0, NULL),
  ('english-counties', 23, 'Cumbria', NULL, 0, NULL),
  ('english-counties', 24, 'Berkshire', NULL, 0, NULL),
  ('english-counties', 25, 'Oxfordshire', NULL, 0, NULL),
  ('english-counties', 26, 'Warwickshire', NULL, 0, NULL),
  ('english-counties', 27, 'Worcestershire', NULL, 0, NULL),
  ('english-counties', 28, 'Durham', NULL, 0, NULL);

-- ── Name 10 London boroughs
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('london-boroughs', 'places', 'Name 10 London boroughs', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('london-boroughs', 1, 'Camden', NULL, 0, NULL),
  ('london-boroughs', 2, 'Islington', NULL, 0, NULL),
  ('london-boroughs', 3, 'Hackney', NULL, 0, NULL),
  ('london-boroughs', 4, 'Westminster', NULL, 0, NULL),
  ('london-boroughs', 5, 'Lambeth', NULL, 0, NULL),
  ('london-boroughs', 6, 'Southwark', NULL, 0, NULL),
  ('london-boroughs', 7, 'Greenwich', NULL, 0, NULL),
  ('london-boroughs', 8, 'Lewisham', NULL, 0, NULL),
  ('london-boroughs', 9, 'Wandsworth', NULL, 0, NULL),
  ('london-boroughs', 10, 'Croydon', NULL, 0, NULL),
  ('london-boroughs', 11, 'Brent', NULL, 0, NULL),
  ('london-boroughs', 12, 'Ealing', NULL, 0, NULL),
  ('london-boroughs', 13, 'Hounslow', NULL, 0, NULL),
  ('london-boroughs', 14, 'Richmond upon Thames', '["Richmond"]', 0, NULL),
  ('london-boroughs', 15, 'Kingston upon Thames', '["Kingston"]', 0, NULL),
  ('london-boroughs', 16, 'Barnet', NULL, 0, NULL),
  ('london-boroughs', 17, 'Enfield', NULL, 0, NULL),
  ('london-boroughs', 18, 'Haringey', NULL, 0, NULL),
  ('london-boroughs', 19, 'Newham', NULL, 0, NULL),
  ('london-boroughs', 20, 'Tower Hamlets', NULL, 0, NULL),
  ('london-boroughs', 21, 'Redbridge', NULL, 0, NULL),
  ('london-boroughs', 22, 'Havering', NULL, 0, NULL),
  ('london-boroughs', 23, 'Bexley', NULL, 0, NULL),
  ('london-boroughs', 24, 'Bromley', NULL, 0, NULL),
  ('london-boroughs', 25, 'Harrow', NULL, 0, NULL),
  ('london-boroughs', 26, 'Hillingdon', NULL, 0, NULL),
  ('london-boroughs', 27, 'Merton', NULL, 0, NULL),
  ('london-boroughs', 28, 'Sutton', NULL, 0, NULL);

-- ── Name 10 seas
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('seas', 'seas', 'Name 10 seas', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('seas', 1, 'Mediterranean Sea', '["Mediterranean"]', 0, NULL),
  ('seas', 2, 'North Sea', NULL, 0, NULL),
  ('seas', 3, 'Baltic Sea', '["Baltic"]', 0, NULL),
  ('seas', 4, 'Black Sea', NULL, 0, NULL),
  ('seas', 5, 'Red Sea', NULL, 0, NULL),
  ('seas', 6, 'Caspian Sea', '["Caspian"]', 0, NULL),
  ('seas', 7, 'Caribbean Sea', '["Caribbean"]', 0, NULL),
  ('seas', 8, 'Arabian Sea', NULL, 0, NULL),
  ('seas', 9, 'South China Sea', NULL, 0, NULL),
  ('seas', 10, 'Coral Sea', NULL, 0, NULL),
  ('seas', 11, 'Tasman Sea', NULL, 0, NULL),
  ('seas', 12, 'Bering Sea', NULL, 0, NULL),
  ('seas', 13, 'Irish Sea', NULL, 0, NULL),
  ('seas', 14, 'Dead Sea', NULL, 0, NULL),
  ('seas', 15, 'Aegean Sea', '["Aegean"]', 0, NULL),
  ('seas', 16, 'Adriatic Sea', '["Adriatic"]', 0, NULL),
  ('seas', 17, 'Yellow Sea', NULL, 0, NULL),
  ('seas', 18, 'Sea of Japan', NULL, 0, NULL),
  ('seas', 19, 'Barents Sea', NULL, 0, NULL),
  ('seas', 20, 'Weddell Sea', NULL, 0, NULL);

-- ── Name 10 mountain ranges
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('mountain-ranges', 'mountains', 'Name 10 mountain ranges', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('mountain-ranges', 1, 'Himalayas', NULL, 0, NULL),
  ('mountain-ranges', 2, 'Andes', NULL, 0, NULL),
  ('mountain-ranges', 3, 'Alps', NULL, 0, NULL),
  ('mountain-ranges', 4, 'Rockies', '["Rocky Mountains"]', 0, NULL),
  ('mountain-ranges', 5, 'Pyrenees', NULL, 0, NULL),
  ('mountain-ranges', 6, 'Appalachians', NULL, 0, NULL),
  ('mountain-ranges', 7, 'Urals', NULL, 0, NULL),
  ('mountain-ranges', 8, 'Atlas Mountains', '["Atlas"]', 0, NULL),
  ('mountain-ranges', 9, 'Carpathians', NULL, 0, NULL),
  ('mountain-ranges', 10, 'Caucasus', NULL, 0, NULL),
  ('mountain-ranges', 11, 'Dolomites', NULL, 0, NULL),
  ('mountain-ranges', 12, 'Apennines', NULL, 0, NULL),
  ('mountain-ranges', 13, 'Sierra Nevada', NULL, 0, NULL),
  ('mountain-ranges', 14, 'Great Dividing Range', NULL, 0, NULL),
  ('mountain-ranges', 15, 'Cascades', NULL, 0, NULL),
  ('mountain-ranges', 16, 'Karakoram', NULL, 0, NULL),
  ('mountain-ranges', 17, 'Hindu Kush', NULL, 0, NULL),
  ('mountain-ranges', 18, 'Drakensberg', NULL, 0, NULL),
  ('mountain-ranges', 19, 'Cairngorms', NULL, 0, NULL),
  ('mountain-ranges', 20, 'Pennines', NULL, 0, NULL);

-- ── Name 10 volcanoes
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('volcanoes', 'places', 'Name 10 volcanoes', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('volcanoes', 1, 'Vesuvius', NULL, 0, NULL),
  ('volcanoes', 2, 'Etna', NULL, 0, NULL),
  ('volcanoes', 3, 'Krakatoa', NULL, 0, NULL),
  ('volcanoes', 4, 'Mount Fuji', '["Fuji"]', 0, NULL),
  ('volcanoes', 5, 'Kilimanjaro', NULL, 0, NULL),
  ('volcanoes', 6, 'Mauna Loa', NULL, 0, NULL),
  ('volcanoes', 7, 'Mount St Helens', '["St Helens"]', 0, NULL),
  ('volcanoes', 8, 'Popocatepetl', NULL, 0, NULL),
  ('volcanoes', 9, 'Cotopaxi', NULL, 0, NULL),
  ('volcanoes', 10, 'Eyjafjallajokull', NULL, 0, NULL),
  ('volcanoes', 11, 'Stromboli', NULL, 0, NULL),
  ('volcanoes', 12, 'Mount Pinatubo', '["Pinatubo"]', 0, NULL),
  ('volcanoes', 13, 'Mount Rainier', '["Rainier"]', 0, NULL),
  ('volcanoes', 14, 'Nyiragongo', NULL, 0, NULL),
  ('volcanoes', 15, 'Teide', NULL, 0, NULL),
  ('volcanoes', 16, 'Hekla', NULL, 0, NULL),
  ('volcanoes', 17, 'Mount Erebus', '["Erebus"]', 0, NULL),
  ('volcanoes', 18, 'Mount Tambora', '["Tambora"]', 0, NULL);

-- ── Name 10 countries with a star on their flag
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('flags-with-a-star', 'countries', 'Name 10 countries with a star on their flag', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('flags-with-a-star', 1, 'United States', '["USA", "America"]', 0, NULL),
  ('flags-with-a-star', 2, 'China', NULL, 0, NULL),
  ('flags-with-a-star', 3, 'Brazil', NULL, 0, NULL),
  ('flags-with-a-star', 4, 'Australia', NULL, 0, NULL),
  ('flags-with-a-star', 5, 'New Zealand', NULL, 0, NULL),
  ('flags-with-a-star', 6, 'Vietnam', NULL, 0, NULL),
  ('flags-with-a-star', 7, 'Turkey', '["Turkiye"]', 0, NULL),
  ('flags-with-a-star', 8, 'Morocco', NULL, 0, NULL),
  ('flags-with-a-star', 9, 'Chile', NULL, 0, NULL),
  ('flags-with-a-star', 10, 'Cuba', NULL, 0, NULL),
  ('flags-with-a-star', 11, 'Somalia', NULL, 0, NULL),
  ('flags-with-a-star', 12, 'Israel', NULL, 0, NULL),
  ('flags-with-a-star', 13, 'Panama', NULL, 0, NULL),
  ('flags-with-a-star', 14, 'Senegal', NULL, 0, NULL),
  ('flags-with-a-star', 15, 'Ghana', NULL, 0, NULL),
  ('flags-with-a-star', 16, 'Ethiopia', NULL, 0, NULL),
  ('flags-with-a-star', 17, 'North Korea', NULL, 0, NULL),
  ('flags-with-a-star', 18, 'Venezuela', NULL, 0, NULL),
  ('flags-with-a-star', 19, 'Malaysia', NULL, 0, NULL),
  ('flags-with-a-star', 20, 'Pakistan', NULL, 0, NULL);

-- ── The 10 most populated cities in the world
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('cities-most-populated', 'cities', 'The 10 most populated cities in the world', 1, 'population');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('cities-most-populated', 1, 'Tokyo', NULL, 37100000, '37.1m'),
  ('cities-most-populated', 2, 'Delhi', NULL, 33800000, '33.8m'),
  ('cities-most-populated', 3, 'Shanghai', NULL, 29900000, '29.9m'),
  ('cities-most-populated', 4, 'Dhaka', NULL, 23900000, '23.9m'),
  ('cities-most-populated', 5, 'Sao Paulo', NULL, 22800000, '22.8m'),
  ('cities-most-populated', 6, 'Cairo', NULL, 22600000, '22.6m'),
  ('cities-most-populated', 7, 'Mexico City', NULL, 22300000, '22.3m'),
  ('cities-most-populated', 8, 'Beijing', NULL, 22200000, '22.2m'),
  ('cities-most-populated', 9, 'Mumbai', '["Bombay"]', 21700000, '21.7m'),
  ('cities-most-populated', 10, 'Osaka', NULL, 19000000, '19.0m');

-- ── The 10 most visited countries
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-most-visited', 'countries', 'The 10 most visited countries', 1, 'visitors');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-most-visited', 1, 'France', NULL, 100000000, '100m'),
  ('countries-most-visited', 2, 'Spain', NULL, 85000000, '85m'),
  ('countries-most-visited', 3, 'United States', '["USA", "America"]', 67000000, '67m'),
  ('countries-most-visited', 4, 'Italy', NULL, 57000000, '57m'),
  ('countries-most-visited', 5, 'Turkey', '["Turkiye"]', 56000000, '56m'),
  ('countries-most-visited', 6, 'Mexico', NULL, 45000000, '45m'),
  ('countries-most-visited', 7, 'United Kingdom', '["UK", "Britain"]', 38000000, '38m'),
  ('countries-most-visited', 8, 'Germany', NULL, 35000000, '35m'),
  ('countries-most-visited', 9, 'Greece', NULL, 33000000, '33m'),
  ('countries-most-visited', 10, 'Austria', NULL, 31000000, '31m');

-- ── The 10 highest mountains in the UK
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('uk-mountains-highest', 'mountains', 'The 10 highest mountains in the UK', 1, 'metres');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('uk-mountains-highest', 1, 'Ben Nevis', NULL, 1345, '1,345m'),
  ('uk-mountains-highest', 2, 'Ben Macdui', '["Ben Macdhui"]', 1309, '1,309m'),
  ('uk-mountains-highest', 3, 'Braeriach', NULL, 1296, '1,296m'),
  ('uk-mountains-highest', 4, 'Cairn Toul', NULL, 1291, '1,291m'),
  ('uk-mountains-highest', 5, 'Sgor an Lochain Uaine', '["Angels Peak"]', 1258, '1,258m'),
  ('uk-mountains-highest', 6, 'Cairn Gorm', '["Cairngorm"]', 1245, '1,245m'),
  ('uk-mountains-highest', 7, 'Aonach Beag', NULL, 1234, '1,234m'),
  ('uk-mountains-highest', 8, 'Aonach Mor', NULL, 1221, '1,221m'),
  ('uk-mountains-highest', 9, 'Carn Mor Dearg', NULL, 1220, '1,220m'),
  ('uk-mountains-highest', 10, 'Ben Lawers', NULL, 1214, '1,214m');

-- ── The 10 longest rivers in the UK
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('uk-rivers-longest', 'rivers', 'The 10 longest rivers in the UK', 1, 'km');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('uk-rivers-longest', 1, 'Severn', NULL, 354, '354km'),
  ('uk-rivers-longest', 2, 'Thames', NULL, 346, '346km'),
  ('uk-rivers-longest', 3, 'Trent', NULL, 298, '298km'),
  ('uk-rivers-longest', 4, 'Great Ouse', '["Ouse"]', 230, '230km'),
  ('uk-rivers-longest', 5, 'Wye', NULL, 215, '215km'),
  ('uk-rivers-longest', 6, 'Tay', NULL, 188, '188km'),
  ('uk-rivers-longest', 7, 'Clyde', NULL, 176, '176km'),
  ('uk-rivers-longest', 8, 'Spey', NULL, 172, '172km'),
  ('uk-rivers-longest', 9, 'Nene', NULL, 161, '161km'),
  ('uk-rivers-longest', 10, 'Tweed', NULL, 156, '156km');

-- ── The 10 largest seas by area
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('seas-largest', 'seas', 'The 10 largest seas by area', 1, 'area');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('seas-largest', 1, 'Philippine Sea', '["Philippine"]', 5695000, '5.7m km2'),
  ('seas-largest', 2, 'Coral Sea', '["Coral"]', 4791000, '4.8m km2'),
  ('seas-largest', 3, 'Arabian Sea', '["Arabian"]', 3862000, '3.9m km2'),
  ('seas-largest', 4, 'South China Sea', '["South China"]', 3685000, '3.7m km2'),
  ('seas-largest', 5, 'Weddell Sea', '["Weddell"]', 2800000, '2.8m km2'),
  ('seas-largest', 6, 'Caribbean Sea', '["Caribbean"]', 2754000, '2.8m km2'),
  ('seas-largest', 7, 'Mediterranean Sea', '["Mediterranean"]', 2510000, '2.5m km2'),
  ('seas-largest', 8, 'Tasman Sea', '["Tasman"]', 2300000, '2.3m km2'),
  ('seas-largest', 9, 'Bay of Bengal', NULL, 2172000, '2.2m km2'),
  ('seas-largest', 10, 'Bering Sea', '["Bering"]', 2000000, '2.0m km2');

-- ── The 10 highest capital cities
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('capitals-highest', 'capitals', 'The 10 highest capital cities', 1, 'metres');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('capitals-highest', 1, 'La Paz', NULL, 3640, '3,640m'),
  ('capitals-highest', 2, 'Quito', NULL, 2850, '2,850m'),
  ('capitals-highest', 3, 'Thimphu', NULL, 2648, '2,648m'),
  ('capitals-highest', 4, 'Bogota', NULL, 2640, '2,640m'),
  ('capitals-highest', 5, 'Addis Ababa', NULL, 2355, '2,355m'),
  ('capitals-highest', 6, 'Asmara', NULL, 2325, '2,325m'),
  ('capitals-highest', 7, 'Sanaa', NULL, 2250, '2,250m'),
  ('capitals-highest', 8, 'Mexico City', NULL, 2240, '2,240m'),
  ('capitals-highest', 9, 'Nairobi', NULL, 1795, '1,795m'),
  ('capitals-highest', 10, 'Kathmandu', NULL, 1400, '1,400m');

-- ── Name 10 actors called David
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-david', 'film', 'Name 10 actors called David', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-david', 1, 'David Tennant', '["Tennant"]', 0, NULL),
  ('actors-david', 2, 'David Niven', '["Niven"]', 0, NULL),
  ('actors-david', 3, 'David Jason', '["Jason"]', 0, NULL),
  ('actors-david', 4, 'David Schwimmer', '["Schwimmer"]', 0, NULL),
  ('actors-david', 5, 'David Duchovny', '["Duchovny"]', 0, NULL),
  ('actors-david', 6, 'David Thewlis', '["Thewlis"]', 0, NULL),
  ('actors-david', 7, 'David Hasselhoff', '["Hasselhoff"]', 0, NULL),
  ('actors-david', 8, 'David Harbour', '["Harbour"]', 0, NULL),
  ('actors-david', 9, 'David Oyelowo', '["Oyelowo"]', 0, NULL),
  ('actors-david', 10, 'David Morrissey', '["Morrissey"]', 0, NULL),
  ('actors-david', 11, 'David Suchet', '["Suchet"]', 0, NULL),
  ('actors-david', 12, 'David Walliams', '["Walliams"]', 0, NULL),
  ('actors-david', 13, 'David Mitchell', '["Mitchell"]', 0, NULL),
  ('actors-david', 14, 'David Spade', '["Spade"]', 0, NULL),
  ('actors-david', 15, 'David Arquette', '["Arquette"]', 0, NULL),
  ('actors-david', 16, 'David Wenham', '["Wenham"]', 0, NULL),
  ('actors-david', 17, 'David Bradley', '["Bradley"]', 0, NULL),
  ('actors-david', 18, 'David Strathairn', '["Strathairn"]', 0, NULL);

-- ── Name 10 actors called Tom
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-tom', 'film', 'Name 10 actors called Tom', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-tom', 1, 'Tom Hanks', '["Hanks"]', 0, NULL),
  ('actors-tom', 2, 'Tom Cruise', '["Cruise"]', 0, NULL),
  ('actors-tom', 3, 'Tom Hardy', '["Hardy"]', 0, NULL),
  ('actors-tom', 4, 'Tom Holland', '["Holland"]', 0, NULL),
  ('actors-tom', 5, 'Tom Hiddleston', '["Hiddleston"]', 0, NULL),
  ('actors-tom', 6, 'Tom Wilkinson', '["Wilkinson"]', 0, NULL),
  ('actors-tom', 7, 'Tom Selleck', '["Selleck"]', 0, NULL),
  ('actors-tom', 8, 'Tom Hollander', '["Hollander"]', 0, NULL),
  ('actors-tom', 9, 'Tom Courtenay', '["Courtenay"]', 0, NULL),
  ('actors-tom', 10, 'Tom Baker', '["Baker"]', 0, NULL),
  ('actors-tom', 11, 'Tom Felton', '["Felton"]', 0, NULL),
  ('actors-tom', 12, 'Tom Berenger', '["Berenger"]', 0, NULL),
  ('actors-tom', 13, 'Tom Sizemore', '["Sizemore"]', 0, NULL),
  ('actors-tom', 14, 'Tom Skerritt', '["Skerritt"]', 0, NULL),
  ('actors-tom', 15, 'Tom Burke', '["Burke"]', 0, NULL),
  ('actors-tom', 16, 'Tom Payne', '["Payne"]', 0, NULL),
  ('actors-tom', 17, 'Tom Bateman', '["Bateman"]', 0, NULL),
  ('actors-tom', 18, 'Tom Hulce', '["Hulce"]', 0, NULL);

-- ── Name 10 actors called John
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-john', 'film', 'Name 10 actors called John', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-john', 1, 'John Wayne', '["Wayne"]', 0, NULL),
  ('actors-john', 2, 'John Travolta', '["Travolta"]', 0, NULL),
  ('actors-john', 3, 'John Cleese', '["Cleese"]', 0, NULL),
  ('actors-john', 4, 'John Goodman', '["Goodman"]', 0, NULL),
  ('actors-john', 5, 'John Malkovich', '["Malkovich"]', 0, NULL),
  ('actors-john', 6, 'John Candy', '["Candy"]', 0, NULL),
  ('actors-john', 7, 'John Hurt', '["Hurt"]', 0, NULL),
  ('actors-john', 8, 'John Lithgow', '["Lithgow"]', 0, NULL),
  ('actors-john', 9, 'John Krasinski', '["Krasinski"]', 0, NULL),
  ('actors-john', 10, 'John Cusack', '["Cusack"]', 0, NULL),
  ('actors-john', 11, 'John Turturro', '["Turturro"]', 0, NULL),
  ('actors-john', 12, 'John Boyega', '["Boyega"]', 0, NULL),
  ('actors-john', 13, 'John C. Reilly', '["Reilly"]', 0, NULL),
  ('actors-john', 14, 'John Rhys-Davies', '["Rhys-Davies"]', 0, NULL),
  ('actors-john', 15, 'John Simm', '["Simm"]', 0, NULL),
  ('actors-john', 16, 'John Barrowman', '["Barrowman"]', 0, NULL),
  ('actors-john', 17, 'John Mills', '["Mills"]', 0, NULL),
  ('actors-john', 18, 'John Gielgud', '["Gielgud"]', 0, NULL);

-- ── Name 10 actors called Michael
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-michael', 'film', 'Name 10 actors called Michael', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-michael', 1, 'Michael Caine', '["Caine"]', 0, NULL),
  ('actors-michael', 2, 'Michael Douglas', '["Douglas"]', 0, NULL),
  ('actors-michael', 3, 'Michael Fassbender', '["Fassbender"]', 0, NULL),
  ('actors-michael', 4, 'Michael Keaton', '["Keaton"]', 0, NULL),
  ('actors-michael', 5, 'Michael Sheen', '["Sheen"]', 0, NULL),
  ('actors-michael', 6, 'Michael Gambon', '["Gambon"]', 0, NULL),
  ('actors-michael', 7, 'Michael Palin', '["Palin"]', 0, NULL),
  ('actors-michael', 8, 'Michael B. Jordan', '["Jordan"]', 0, NULL),
  ('actors-michael', 9, 'Michael Cera', '["Cera"]', 0, NULL),
  ('actors-michael', 10, 'Michael Shannon', '["Shannon"]', 0, NULL),
  ('actors-michael', 11, 'Michael Stuhlbarg', '["Stuhlbarg"]', 0, NULL),
  ('actors-michael', 12, 'Michael Pena', '["Pena"]', 0, NULL),
  ('actors-michael', 13, 'Michael Madsen', '["Madsen"]', 0, NULL),
  ('actors-michael', 14, 'Michael York', '["York"]', 0, NULL),
  ('actors-michael', 15, 'Michael Clarke Duncan', '["Clarke Duncan"]', 0, NULL),
  ('actors-michael', 16, 'Michael Imperioli', '["Imperioli"]', 0, NULL),
  ('actors-michael', 17, 'Michael Rooker', '["Rooker"]', 0, NULL),
  ('actors-michael', 18, 'Michael J. Fox', '["Fox"]', 0, NULL);

-- ── Name 10 actors called James
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-james', 'film', 'Name 10 actors called James', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-james', 1, 'James Stewart', '["Stewart"]', 0, NULL),
  ('actors-james', 2, 'James McAvoy', '["McAvoy"]', 0, NULL),
  ('actors-james', 3, 'James Earl Jones', '["Earl Jones"]', 0, NULL),
  ('actors-james', 4, 'James Franco', '["Franco"]', 0, NULL),
  ('actors-james', 5, 'James Caan', '["Caan"]', 0, NULL),
  ('actors-james', 6, 'James Gandolfini', '["Gandolfini"]', 0, NULL),
  ('actors-james', 7, 'James Spader', '["Spader"]', 0, NULL),
  ('actors-james', 8, 'James Nesbitt', '["Nesbitt"]', 0, NULL),
  ('actors-james', 9, 'James Cromwell', '["Cromwell"]', 0, NULL),
  ('actors-james', 10, 'James Corden', '["Corden"]', 0, NULL),
  ('actors-james', 11, 'James Marsden', '["Marsden"]', 0, NULL),
  ('actors-james', 12, 'James Mason', '["Mason"]', 0, NULL),
  ('actors-james', 13, 'James Norton', '["Norton"]', 0, NULL),
  ('actors-james', 14, 'James Purefoy', '["Purefoy"]', 0, NULL),
  ('actors-james', 15, 'James D''Arcy', '["D''Arcy"]', 0, NULL),
  ('actors-james', 16, 'James Woods', '["Woods"]', 0, NULL);

-- ── Name 10 actors called Chris or Christopher
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-chris', 'film', 'Name 10 actors called Chris or Christopher', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-chris', 1, 'Chris Evans', '["Evans"]', 0, NULL),
  ('actors-chris', 2, 'Chris Hemsworth', '["Hemsworth"]', 0, NULL),
  ('actors-chris', 3, 'Chris Pratt', '["Pratt"]', 0, NULL),
  ('actors-chris', 4, 'Chris Pine', '["Pine"]', 0, NULL),
  ('actors-chris', 5, 'Chris Rock', '["Rock"]', 0, NULL),
  ('actors-chris', 6, 'Chris Tucker', '["Tucker"]', 0, NULL),
  ('actors-chris', 7, 'Chris Cooper', '["Cooper"]', 0, NULL),
  ('actors-chris', 8, 'Chris O''Dowd', '["O''Dowd"]', 0, NULL),
  ('actors-chris', 9, 'Chris Noth', '["Noth"]', 0, NULL),
  ('actors-chris', 10, 'Chris Farley', '["Farley"]', 0, NULL),
  ('actors-chris', 11, 'Chris Messina', '["Messina"]', 0, NULL),
  ('actors-chris', 12, 'Chris Klein', '["Klein"]', 0, NULL),
  ('actors-chris', 13, 'Christopher Walken', '["Walken"]', 0, NULL),
  ('actors-chris', 14, 'Christopher Lee', '["Lee"]', 0, NULL),
  ('actors-chris', 15, 'Christopher Plummer', '["Plummer"]', 0, NULL),
  ('actors-chris', 16, 'Christopher Lloyd', '["Lloyd"]', 0, NULL),
  ('actors-chris', 17, 'Christopher Reeve', '["Reeve"]', 0, NULL),
  ('actors-chris', 18, 'Christopher Eccleston', '["Eccleston"]', 0, NULL),
  ('actors-chris', 19, 'Christopher Guest', '["Guest"]', 0, NULL),
  ('actors-chris', 20, 'Christopher Mintz-Plasse', '["Mintz-Plasse"]', 0, NULL);

-- ── Name 10 actors called Robert
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-robert', 'film', 'Name 10 actors called Robert', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-robert', 1, 'Robert De Niro', '["De Niro"]', 0, NULL),
  ('actors-robert', 2, 'Robert Downey Jr', '["Downey"]', 0, NULL),
  ('actors-robert', 3, 'Robert Redford', '["Redford"]', 0, NULL),
  ('actors-robert', 4, 'Robert Duvall', '["Duvall"]', 0, NULL),
  ('actors-robert', 5, 'Robert Pattinson', '["Pattinson"]', 0, NULL),
  ('actors-robert', 6, 'Robert Carlyle', '["Carlyle"]', 0, NULL),
  ('actors-robert', 7, 'Robert Shaw', '["Shaw"]', 0, NULL),
  ('actors-robert', 8, 'Robert Englund', '["Englund"]', 0, NULL),
  ('actors-robert', 9, 'Robert Sheehan', '["Sheehan"]', 0, NULL),
  ('actors-robert', 10, 'Robert Mitchum', '["Mitchum"]', 0, NULL),
  ('actors-robert', 11, 'Robert Wagner', '["Wagner"]', 0, NULL),
  ('actors-robert', 12, 'Robert Vaughn', '["Vaughn"]', 0, NULL),
  ('actors-robert', 13, 'Robert Webb', '["Webb"]', 0, NULL),
  ('actors-robert', 14, 'Robert Lindsay', '["Lindsay"]', 0, NULL),
  ('actors-robert', 15, 'Robert Donat', '["Donat"]', 0, NULL),
  ('actors-robert', 16, 'Robert Morley', '["Morley"]', 0, NULL);

-- ── Name 10 actors called Mark
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-mark', 'film', 'Name 10 actors called Mark', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-mark', 1, 'Mark Ruffalo', '["Ruffalo"]', 0, NULL),
  ('actors-mark', 2, 'Mark Wahlberg', '["Wahlberg"]', 0, NULL),
  ('actors-mark', 3, 'Mark Hamill', '["Hamill"]', 0, NULL),
  ('actors-mark', 4, 'Mark Rylance', '["Rylance"]', 0, NULL),
  ('actors-mark', 5, 'Mark Strong', '["Strong"]', 0, NULL),
  ('actors-mark', 6, 'Mark Addy', '["Addy"]', 0, NULL),
  ('actors-mark', 7, 'Mark Gatiss', '["Gatiss"]', 0, NULL),
  ('actors-mark', 8, 'Mark Williams', '["Williams"]', 0, NULL),
  ('actors-mark', 9, 'Mark Harmon', '["Harmon"]', 0, NULL),
  ('actors-mark', 10, 'Mark Duplass', '["Duplass"]', 0, NULL),
  ('actors-mark', 11, 'Mark Consuelos', '["Consuelos"]', 0, NULL),
  ('actors-mark', 12, 'Mark Sheppard', '["Sheppard"]', 0, NULL),
  ('actors-mark', 13, 'Mark Heap', '["Heap"]', 0, NULL),
  ('actors-mark', 14, 'Mark Benton', '["Benton"]', 0, NULL),
  ('actors-mark', 15, 'Mark Bonnar', '["Bonnar"]', 0, NULL);

-- ── Name 10 actors called Paul
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-paul', 'film', 'Name 10 actors called Paul', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-paul', 1, 'Paul Newman', '["Newman"]', 0, NULL),
  ('actors-paul', 2, 'Paul Rudd', '["Rudd"]', 0, NULL),
  ('actors-paul', 3, 'Paul Giamatti', '["Giamatti"]', 0, NULL),
  ('actors-paul', 4, 'Paul Bettany', '["Bettany"]', 0, NULL),
  ('actors-paul', 5, 'Paul Dano', '["Dano"]', 0, NULL),
  ('actors-paul', 6, 'Paul Mescal', '["Mescal"]', 0, NULL),
  ('actors-paul', 7, 'Paul Walker', '["Walker"]', 0, NULL),
  ('actors-paul', 8, 'Paul Hogan', '["Hogan"]', 0, NULL),
  ('actors-paul', 9, 'Paul Whitehouse', '["Whitehouse"]', 0, NULL),
  ('actors-paul', 10, 'Paul Scofield', '["Scofield"]', 0, NULL),
  ('actors-paul', 11, 'Paul Reubens', '["Reubens"]', 0, NULL),
  ('actors-paul', 12, 'Paul Sorvino', '["Sorvino"]', 0, NULL),
  ('actors-paul', 13, 'Paul Rhys', '["Rhys"]', 0, NULL),
  ('actors-paul', 14, 'Paul Dooley', '["Dooley"]', 0, NULL);

-- ── Name 10 actors called Emma
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-emma', 'film', 'Name 10 actors called Emma', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-emma', 1, 'Emma Thompson', '["Thompson"]', 0, NULL),
  ('actors-emma', 2, 'Emma Stone', '["Stone"]', 0, NULL),
  ('actors-emma', 3, 'Emma Watson', '["Watson"]', 0, NULL),
  ('actors-emma', 4, 'Emma Roberts', '["Roberts"]', 0, NULL),
  ('actors-emma', 5, 'Emma Corrin', '["Corrin"]', 0, NULL),
  ('actors-emma', 6, 'Emma Mackey', '["Mackey"]', 0, NULL),
  ('actors-emma', 7, 'Emma Chambers', '["Chambers"]', 0, NULL),
  ('actors-emma', 8, 'Emma D''Arcy', '["D''Arcy"]', 0, NULL),
  ('actors-emma', 9, 'Emma Myles', '["Myles"]', 0, NULL),
  ('actors-emma', 10, 'Emma Rigby', '["Rigby"]', 0, NULL),
  ('actors-emma', 11, 'Emma Samms', '["Samms"]', 0, NULL),
  ('actors-emma', 12, 'Emma Appleton', '["Appleton"]', 0, NULL),
  ('actors-emma', 13, 'Emma Fielding', '["Fielding"]', 0, NULL);

-- ── Name 10 actors called Jennifer
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-jennifer', 'film', 'Name 10 actors called Jennifer', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-jennifer', 1, 'Jennifer Lawrence', '["Lawrence"]', 0, NULL),
  ('actors-jennifer', 2, 'Jennifer Aniston', '["Aniston"]', 0, NULL),
  ('actors-jennifer', 3, 'Jennifer Lopez', '["Lopez"]', 0, NULL),
  ('actors-jennifer', 4, 'Jennifer Connelly', '["Connelly"]', 0, NULL),
  ('actors-jennifer', 5, 'Jennifer Garner', '["Garner"]', 0, NULL),
  ('actors-jennifer', 6, 'Jennifer Coolidge', '["Coolidge"]', 0, NULL),
  ('actors-jennifer', 7, 'Jennifer Love Hewitt', '["Love Hewitt"]', 0, NULL),
  ('actors-jennifer', 8, 'Jennifer Saunders', '["Saunders"]', 0, NULL),
  ('actors-jennifer', 9, 'Jennifer Tilly', '["Tilly"]', 0, NULL),
  ('actors-jennifer', 10, 'Jennifer Ehle', '["Ehle"]', 0, NULL),
  ('actors-jennifer', 11, 'Jennifer Beals', '["Beals"]', 0, NULL),
  ('actors-jennifer', 12, 'Jennifer Grey', '["Grey"]', 0, NULL),
  ('actors-jennifer', 13, 'Jennifer Jason Leigh', '["Jason Leigh"]', 0, NULL),
  ('actors-jennifer', 14, 'Jennifer Esposito', '["Esposito"]', 0, NULL);

-- ── Name 10 actors called Sarah
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-sarah', 'film', 'Name 10 actors called Sarah', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-sarah', 1, 'Sarah Jessica Parker', '["Jessica Parker"]', 0, NULL),
  ('actors-sarah', 2, 'Sarah Michelle Gellar', '["Michelle Gellar"]', 0, NULL),
  ('actors-sarah', 3, 'Sarah Lancashire', '["Lancashire"]', 0, NULL),
  ('actors-sarah', 4, 'Sarah Paulson', '["Paulson"]', 0, NULL),
  ('actors-sarah', 5, 'Sarah Silverman', '["Silverman"]', 0, NULL),
  ('actors-sarah', 6, 'Sarah Snook', '["Snook"]', 0, NULL),
  ('actors-sarah', 7, 'Sarah Hyland', '["Hyland"]', 0, NULL),
  ('actors-sarah', 8, 'Sarah Chalke', '["Chalke"]', 0, NULL),
  ('actors-sarah', 9, 'Sarah Polley', '["Polley"]', 0, NULL),
  ('actors-sarah', 10, 'Sarah Greene', '["Greene"]', 0, NULL),
  ('actors-sarah', 11, 'Sarah Bolger', '["Bolger"]', 0, NULL),
  ('actors-sarah', 12, 'Sarah Wayne Callies', '["Wayne Callies"]', 0, NULL),
  ('actors-sarah', 13, 'Sarah Goldberg', '["Goldberg"]', 0, NULL),
  ('actors-sarah', 14, 'Sarah Alexander', '["Alexander"]', 0, NULL);

-- ── Name 10 actors called Kate or Katherine
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-kate', 'film', 'Name 10 actors called Kate or Katherine', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-kate', 1, 'Kate Winslet', '["Winslet"]', 0, NULL),
  ('actors-kate', 2, 'Kate Hudson', '["Hudson"]', 0, NULL),
  ('actors-kate', 3, 'Kate Beckinsale', '["Beckinsale"]', 0, NULL),
  ('actors-kate', 4, 'Kate Bosworth', '["Bosworth"]', 0, NULL),
  ('actors-kate', 5, 'Kate Mara', '["Mara"]', 0, NULL),
  ('actors-kate', 6, 'Kate Walsh', '["Walsh"]', 0, NULL),
  ('actors-kate', 7, 'Kate McKinnon', '["McKinnon"]', 0, NULL),
  ('actors-kate', 8, 'Kate Burton', '["Burton"]', 0, NULL),
  ('actors-kate', 9, 'Kate Mulgrew', '["Mulgrew"]', 0, NULL),
  ('actors-kate', 10, 'Kate Dickie', '["Dickie"]', 0, NULL),
  ('actors-kate', 11, 'Kate Ashfield', '["Ashfield"]', 0, NULL),
  ('actors-kate', 12, 'Kate Fleetwood', '["Fleetwood"]', 0, NULL),
  ('actors-kate', 13, 'Katherine Hepburn', '["Hepburn"]', 0, NULL),
  ('actors-kate', 14, 'Katherine Heigl', '["Heigl"]', 0, NULL),
  ('actors-kate', 15, 'Katherine Waterston', '["Waterston"]', 0, NULL);

-- ── Name 10 actors called Anna
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-anna', 'film', 'Name 10 actors called Anna', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-anna', 1, 'Anna Kendrick', '["Kendrick"]', 0, NULL),
  ('actors-anna', 2, 'Anna Faris', '["Faris"]', 0, NULL),
  ('actors-anna', 3, 'Anna Paquin', '["Paquin"]', 0, NULL),
  ('actors-anna', 4, 'Anna Friel', '["Friel"]', 0, NULL),
  ('actors-anna', 5, 'Anna Chancellor', '["Chancellor"]', 0, NULL),
  ('actors-anna', 6, 'Anna Massey', '["Massey"]', 0, NULL),
  ('actors-anna', 7, 'Anna Maxwell Martin', '["Maxwell Martin"]', 0, NULL),
  ('actors-anna', 8, 'Anna Camp', '["Camp"]', 0, NULL),
  ('actors-anna', 9, 'Anna Torv', '["Torv"]', 0, NULL),
  ('actors-anna', 10, 'Anna Gunn', '["Gunn"]', 0, NULL),
  ('actors-anna', 11, 'Anna Karina', '["Karina"]', 0, NULL),
  ('actors-anna', 12, 'Anna Chlumsky', '["Chlumsky"]', 0, NULL),
  ('actors-anna', 13, 'Anna Popplewell', '["Popplewell"]', 0, NULL);

-- ── Name 10 actors who have won the Best Actor Oscar
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-oscar-best-actor', 'film', 'Name 10 actors who have won the Best Actor Oscar', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-oscar-best-actor', 1, 'Daniel Day-Lewis', '["Day Lewis"]', 0, NULL),
  ('actors-oscar-best-actor', 2, 'Anthony Hopkins', '["Hopkins"]', 0, NULL),
  ('actors-oscar-best-actor', 3, 'Tom Hanks', '["Hanks"]', 0, NULL),
  ('actors-oscar-best-actor', 4, 'Al Pacino', '["Pacino"]', 0, NULL),
  ('actors-oscar-best-actor', 5, 'Jack Nicholson', '["Nicholson"]', 0, NULL),
  ('actors-oscar-best-actor', 6, 'Marlon Brando', '["Brando"]', 0, NULL),
  ('actors-oscar-best-actor', 7, 'Dustin Hoffman', '["Hoffman"]', 0, NULL),
  ('actors-oscar-best-actor', 8, 'Russell Crowe', '["Crowe"]', 0, NULL),
  ('actors-oscar-best-actor', 9, 'Denzel Washington', '["Denzel"]', 0, NULL),
  ('actors-oscar-best-actor', 10, 'Leonardo DiCaprio', '["DiCaprio"]', 0, NULL),
  ('actors-oscar-best-actor', 11, 'Matthew McConaughey', '["McConaughey"]', 0, NULL),
  ('actors-oscar-best-actor', 12, 'Eddie Redmayne', '["Redmayne"]', 0, NULL),
  ('actors-oscar-best-actor', 13, 'Casey Affleck', '["Casey Affleck"]', 0, NULL),
  ('actors-oscar-best-actor', 14, 'Gary Oldman', '["Oldman"]', 0, NULL),
  ('actors-oscar-best-actor', 15, 'Rami Malek', '["Malek"]', 0, NULL),
  ('actors-oscar-best-actor', 16, 'Joaquin Phoenix', '["Phoenix"]', 0, NULL),
  ('actors-oscar-best-actor', 17, 'Will Smith', '["Will Smith"]', 0, NULL),
  ('actors-oscar-best-actor', 18, 'Brendan Fraser', '["Fraser"]', 0, NULL),
  ('actors-oscar-best-actor', 19, 'Cillian Murphy', '["Cillian"]', 0, NULL),
  ('actors-oscar-best-actor', 20, 'Adrien Brody', '["Brody"]', 0, NULL);

-- ── Name 10 actors who have won the Best Actress Oscar
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-oscar-best-actress', 'film', 'Name 10 actors who have won the Best Actress Oscar', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-oscar-best-actress', 1, 'Meryl Streep', '["Streep"]', 0, NULL),
  ('actors-oscar-best-actress', 2, 'Katharine Hepburn', '["Hepburn"]', 0, NULL),
  ('actors-oscar-best-actress', 3, 'Frances McDormand', '["McDormand"]', 0, NULL),
  ('actors-oscar-best-actress', 4, 'Jodie Foster', '["Foster"]', 0, NULL),
  ('actors-oscar-best-actress', 5, 'Hilary Swank', '["Swank"]', 0, NULL),
  ('actors-oscar-best-actress', 6, 'Emma Stone', '["Emma Stone"]', 0, NULL),
  ('actors-oscar-best-actress', 7, 'Olivia Colman', '["Colman"]', 0, NULL),
  ('actors-oscar-best-actress', 8, 'Renee Zellweger', '["Zellweger"]', 0, NULL),
  ('actors-oscar-best-actress', 9, 'Nicole Kidman', '["Kidman"]', 0, NULL),
  ('actors-oscar-best-actress', 10, 'Julia Roberts', '["Julia Roberts"]', 0, NULL),
  ('actors-oscar-best-actress', 11, 'Charlize Theron', '["Theron"]', 0, NULL),
  ('actors-oscar-best-actress', 12, 'Reese Witherspoon', '["Witherspoon"]', 0, NULL),
  ('actors-oscar-best-actress', 13, 'Marion Cotillard', '["Cotillard"]', 0, NULL),
  ('actors-oscar-best-actress', 14, 'Kate Winslet', '["Winslet"]', 0, NULL),
  ('actors-oscar-best-actress', 15, 'Natalie Portman', '["Portman"]', 0, NULL),
  ('actors-oscar-best-actress', 16, 'Jennifer Lawrence', '["Lawrence"]', 0, NULL),
  ('actors-oscar-best-actress', 17, 'Cate Blanchett', '["Blanchett"]', 0, NULL),
  ('actors-oscar-best-actress', 18, 'Brie Larson', '["Larson"]', 0, NULL),
  ('actors-oscar-best-actress', 19, 'Michelle Yeoh', '["Yeoh"]', 0, NULL),
  ('actors-oscar-best-actress', 20, 'Sandra Bullock', '["Bullock"]', 0, NULL);

-- ── Name 10 actors who have been in a Marvel film
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-marvel', 'film', 'Name 10 actors who have been in a Marvel film', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-marvel', 1, 'Robert Downey Jr', '["Downey"]', 0, NULL),
  ('actors-marvel', 2, 'Chris Evans', '["Evans"]', 0, NULL),
  ('actors-marvel', 3, 'Chris Hemsworth', '["Hemsworth"]', 0, NULL),
  ('actors-marvel', 4, 'Scarlett Johansson', '["Johansson"]', 0, NULL),
  ('actors-marvel', 5, 'Mark Ruffalo', '["Ruffalo"]', 0, NULL),
  ('actors-marvel', 6, 'Jeremy Renner', '["Renner"]', 0, NULL),
  ('actors-marvel', 7, 'Tom Holland', '["Holland"]', 0, NULL),
  ('actors-marvel', 8, 'Benedict Cumberbatch', '["Cumberbatch"]', 0, NULL),
  ('actors-marvel', 9, 'Chadwick Boseman', '["Boseman"]', 0, NULL),
  ('actors-marvel', 10, 'Paul Rudd', '["Rudd"]', 0, NULL),
  ('actors-marvel', 11, 'Brie Larson', '["Larson"]', 0, NULL),
  ('actors-marvel', 12, 'Samuel L. Jackson', '["Samuel L Jackson"]', 0, NULL),
  ('actors-marvel', 13, 'Zoe Saldana', '["Saldana"]', 0, NULL),
  ('actors-marvel', 14, 'Chris Pratt', '["Pratt"]', 0, NULL),
  ('actors-marvel', 15, 'Dave Bautista', '["Bautista"]', 0, NULL),
  ('actors-marvel', 16, 'Tom Hiddleston', '["Hiddleston"]', 0, NULL),
  ('actors-marvel', 17, 'Elizabeth Olsen', '["Olsen"]', 0, NULL),
  ('actors-marvel', 18, 'Anthony Mackie', '["Mackie"]', 0, NULL),
  ('actors-marvel', 19, 'Sebastian Stan', '["Sebastian Stan"]', 0, NULL),
  ('actors-marvel', 20, 'Don Cheadle', '["Cheadle"]', 0, NULL);

-- ── Name 10 actors in the Harry Potter films
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-harry-potter', 'film', 'Name 10 actors in the Harry Potter films', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-harry-potter', 1, 'Daniel Radcliffe', '["Radcliffe"]', 0, NULL),
  ('actors-harry-potter', 2, 'Rupert Grint', '["Grint"]', 0, NULL),
  ('actors-harry-potter', 3, 'Emma Watson', '["Watson"]', 0, NULL),
  ('actors-harry-potter', 4, 'Alan Rickman', '["Rickman"]', 0, NULL),
  ('actors-harry-potter', 5, 'Maggie Smith', '["Maggie Smith"]', 0, NULL),
  ('actors-harry-potter', 6, 'Richard Harris', '["Harris"]', 0, NULL),
  ('actors-harry-potter', 7, 'Michael Gambon', '["Gambon"]', 0, NULL),
  ('actors-harry-potter', 8, 'Robbie Coltrane', '["Coltrane"]', 0, NULL),
  ('actors-harry-potter', 9, 'Ralph Fiennes', '["Fiennes"]', 0, NULL),
  ('actors-harry-potter', 10, 'Helena Bonham Carter', '["Bonham Carter"]', 0, NULL),
  ('actors-harry-potter', 11, 'Gary Oldman', '["Oldman"]', 0, NULL),
  ('actors-harry-potter', 12, 'David Thewlis', '["Thewlis"]', 0, NULL),
  ('actors-harry-potter', 13, 'Imelda Staunton', '["Staunton"]', 0, NULL),
  ('actors-harry-potter', 14, 'Jason Isaacs', '["Isaacs"]', 0, NULL),
  ('actors-harry-potter', 15, 'Tom Felton', '["Felton"]', 0, NULL),
  ('actors-harry-potter', 16, 'Julie Walters', '["Walters"]', 0, NULL),
  ('actors-harry-potter', 17, 'Timothy Spall', '["Spall"]', 0, NULL),
  ('actors-harry-potter', 18, 'Warwick Davis', '["Warwick Davis"]', 0, NULL),
  ('actors-harry-potter', 19, 'Emma Thompson', '["Thompson"]', 0, NULL),
  ('actors-harry-potter', 20, 'John Hurt', '["Hurt"]', 0, NULL);

-- ── Name 10 knighted or damed British actors
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-knighted', 'film', 'Name 10 knighted or damed British actors', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-knighted', 1, 'Ian McKellen', '["McKellen"]', 0, NULL),
  ('actors-knighted', 2, 'Anthony Hopkins', '["Hopkins"]', 0, NULL),
  ('actors-knighted', 3, 'Michael Caine', '["Caine"]', 0, NULL),
  ('actors-knighted', 4, 'Patrick Stewart', '["Patrick Stewart"]', 0, NULL),
  ('actors-knighted', 5, 'Derek Jacobi', '["Jacobi"]', 0, NULL),
  ('actors-knighted', 6, 'Kenneth Branagh', '["Branagh"]', 0, NULL),
  ('actors-knighted', 7, 'Ben Kingsley', '["Kingsley"]', 0, NULL),
  ('actors-knighted', 8, 'Lenny Henry', '["Lenny Henry"]', 0, NULL),
  ('actors-knighted', 9, 'Mark Rylance', '["Rylance"]', 0, NULL),
  ('actors-knighted', 10, 'Sean Connery', '["Connery"]', 0, NULL),
  ('actors-knighted', 11, 'John Gielgud', '["Gielgud"]', 0, NULL),
  ('actors-knighted', 12, 'Laurence Olivier', '["Olivier"]', 0, NULL),
  ('actors-knighted', 13, 'Alec Guinness', '["Guinness"]', 0, NULL),
  ('actors-knighted', 14, 'Roger Moore', '["Roger Moore"]', 0, NULL),
  ('actors-knighted', 15, 'Michael Gambon', '["Gambon"]', 0, NULL),
  ('actors-knighted', 16, 'Judi Dench', '["Dench"]', 0, NULL),
  ('actors-knighted', 17, 'Maggie Smith', '["Maggie Smith"]', 0, NULL),
  ('actors-knighted', 18, 'Helen Mirren', '["Mirren"]', 0, NULL),
  ('actors-knighted', 19, 'Julie Andrews', '["Andrews"]', 0, NULL),
  ('actors-knighted', 20, 'Emma Thompson', '["Thompson"]', 0, NULL);

-- ── Name 10 actors who have won two or more acting Oscars
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-two-oscars', 'film', 'Name 10 actors who have won two or more acting Oscars', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-two-oscars', 1, 'Katharine Hepburn', '["Hepburn"]', 0, NULL),
  ('actors-two-oscars', 2, 'Daniel Day-Lewis', '["Day Lewis"]', 0, NULL),
  ('actors-two-oscars', 3, 'Meryl Streep', '["Streep"]', 0, NULL),
  ('actors-two-oscars', 4, 'Jack Nicholson', '["Nicholson"]', 0, NULL),
  ('actors-two-oscars', 5, 'Ingrid Bergman', '["Bergman"]', 0, NULL),
  ('actors-two-oscars', 6, 'Walter Brennan', '["Brennan"]', 0, NULL),
  ('actors-two-oscars', 7, 'Bette Davis', '["Bette Davis"]', 0, NULL),
  ('actors-two-oscars', 8, 'Olivia de Havilland', '["de Havilland"]', 0, NULL),
  ('actors-two-oscars', 9, 'Elizabeth Taylor', '["Elizabeth Taylor"]', 0, NULL),
  ('actors-two-oscars', 10, 'Vivien Leigh', '["Vivien Leigh"]', 0, NULL),
  ('actors-two-oscars', 11, 'Spencer Tracy', '["Tracy"]', 0, NULL),
  ('actors-two-oscars', 12, 'Marlon Brando', '["Brando"]', 0, NULL),
  ('actors-two-oscars', 13, 'Tom Hanks', '["Hanks"]', 0, NULL),
  ('actors-two-oscars', 14, 'Dustin Hoffman', '["Hoffman"]', 0, NULL),
  ('actors-two-oscars', 15, 'Sally Field', '["Sally Field"]', 0, NULL),
  ('actors-two-oscars', 16, 'Jane Fonda', '["Fonda"]', 0, NULL),
  ('actors-two-oscars', 17, 'Frances McDormand', '["McDormand"]', 0, NULL),
  ('actors-two-oscars', 18, 'Mahershala Ali', '["Mahershala"]', 0, NULL),
  ('actors-two-oscars', 19, 'Christoph Waltz', '["Waltz"]', 0, NULL),
  ('actors-two-oscars', 20, 'Cate Blanchett', '["Blanchett"]', 0, NULL),
  ('actors-two-oscars', 21, 'Anthony Hopkins', '["Hopkins"]', 0, NULL),
  ('actors-two-oscars', 22, 'Emma Stone', '["Emma Stone"]', 0, NULL);

-- ── Name 10 actors who have played a superhero
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-superheroes', 'film', 'Name 10 actors who have played a superhero', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-superheroes', 1, 'Christopher Reeve', '["Reeve"]', 0, NULL),
  ('actors-superheroes', 2, 'Michael Keaton', '["Keaton"]', 0, NULL),
  ('actors-superheroes', 3, 'Christian Bale', '["Bale"]', 0, NULL),
  ('actors-superheroes', 4, 'Ben Affleck', '["Affleck"]', 0, NULL),
  ('actors-superheroes', 5, 'Robert Pattinson', '["Pattinson"]', 0, NULL),
  ('actors-superheroes', 6, 'Henry Cavill', '["Cavill"]', 0, NULL),
  ('actors-superheroes', 7, 'Tobey Maguire', '["Maguire"]', 0, NULL),
  ('actors-superheroes', 8, 'Andrew Garfield', '["Garfield"]', 0, NULL),
  ('actors-superheroes', 9, 'Tom Holland', '["Holland"]', 0, NULL),
  ('actors-superheroes', 10, 'Hugh Jackman', '["Jackman"]', 0, NULL),
  ('actors-superheroes', 11, 'Ryan Reynolds', '["Reynolds"]', 0, NULL),
  ('actors-superheroes', 12, 'Gal Gadot', '["Gadot"]', 0, NULL),
  ('actors-superheroes', 13, 'Chris Evans', '["Evans"]', 0, NULL),
  ('actors-superheroes', 14, 'Chris Hemsworth', '["Hemsworth"]', 0, NULL),
  ('actors-superheroes', 15, 'Robert Downey Jr', '["Downey"]', 0, NULL),
  ('actors-superheroes', 16, 'Jason Momoa', '["Momoa"]', 0, NULL),
  ('actors-superheroes', 17, 'Ezra Miller', '["Ezra Miller"]', 0, NULL),
  ('actors-superheroes', 18, 'Brie Larson', '["Larson"]', 0, NULL),
  ('actors-superheroes', 19, 'Chadwick Boseman', '["Boseman"]', 0, NULL),
  ('actors-superheroes', 20, 'Val Kilmer', '["Kilmer"]', 0, NULL);

-- ── Name 10 actors who have voiced an animated character
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-voiced-animation', 'film', 'Name 10 actors who have voiced an animated character', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-voiced-animation', 1, 'Tom Hanks', '["Hanks"]', 0, NULL),
  ('actors-voiced-animation', 2, 'Tim Allen', '["Tim Allen"]', 0, NULL),
  ('actors-voiced-animation', 3, 'Robin Williams', '["Robin Williams"]', 0, NULL),
  ('actors-voiced-animation', 4, 'Eddie Murphy', '["Murphy"]', 0, NULL),
  ('actors-voiced-animation', 5, 'Mike Myers', '["Myers"]', 0, NULL),
  ('actors-voiced-animation', 6, 'Cameron Diaz', '["Diaz"]', 0, NULL),
  ('actors-voiced-animation', 7, 'Ellen DeGeneres', '["DeGeneres"]', 0, NULL),
  ('actors-voiced-animation', 8, 'Billy Crystal', '["Crystal"]', 0, NULL),
  ('actors-voiced-animation', 9, 'John Goodman', '["Goodman"]', 0, NULL),
  ('actors-voiced-animation', 10, 'Holly Hunter', '["Hunter"]', 0, NULL),
  ('actors-voiced-animation', 11, 'Idris Elba', '["Elba"]', 0, NULL),
  ('actors-voiced-animation', 12, 'Scarlett Johansson', '["Johansson"]', 0, NULL),
  ('actors-voiced-animation', 13, 'Bill Murray', '["Bill Murray"]', 0, NULL),
  ('actors-voiced-animation', 14, 'Dustin Hoffman', '["Hoffman"]', 0, NULL),
  ('actors-voiced-animation', 15, 'Jack Black', '["Jack Black"]', 0, NULL),
  ('actors-voiced-animation', 16, 'Angelina Jolie', '["Jolie"]', 0, NULL),
  ('actors-voiced-animation', 17, 'Chris Pratt', '["Pratt"]', 0, NULL),
  ('actors-voiced-animation', 18, 'Owen Wilson', '["Owen Wilson"]', 0, NULL);

-- ── Name 10 actors in the Star Wars films
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-star-wars', 'film', 'Name 10 actors in the Star Wars films', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-star-wars', 1, 'Mark Hamill', '["Hamill"]', 0, NULL),
  ('actors-star-wars', 2, 'Harrison Ford', '["Harrison Ford"]', 0, NULL),
  ('actors-star-wars', 3, 'Carrie Fisher', '["Fisher"]', 0, NULL),
  ('actors-star-wars', 4, 'Alec Guinness', '["Guinness"]', 0, NULL),
  ('actors-star-wars', 5, 'Ewan McGregor', '["McGregor"]', 0, NULL),
  ('actors-star-wars', 6, 'Liam Neeson', '["Neeson"]', 0, NULL),
  ('actors-star-wars', 7, 'Natalie Portman', '["Portman"]', 0, NULL),
  ('actors-star-wars', 8, 'Hayden Christensen', '["Christensen"]', 0, NULL),
  ('actors-star-wars', 9, 'Samuel L. Jackson', '["Samuel L Jackson"]', 0, NULL),
  ('actors-star-wars', 10, 'Christopher Lee', '["Christopher Lee"]', 0, NULL),
  ('actors-star-wars', 11, 'Ian McDiarmid', '["McDiarmid"]', 0, NULL),
  ('actors-star-wars', 12, 'Daisy Ridley', '["Ridley"]', 0, NULL),
  ('actors-star-wars', 13, 'John Boyega', '["Boyega"]', 0, NULL),
  ('actors-star-wars', 14, 'Adam Driver', '["Driver"]', 0, NULL),
  ('actors-star-wars', 15, 'Oscar Isaac', '["Isaac"]', 0, NULL),
  ('actors-star-wars', 16, 'Domhnall Gleeson', '["Gleeson"]', 0, NULL),
  ('actors-star-wars', 17, 'Andy Serkis', '["Serkis"]', 0, NULL),
  ('actors-star-wars', 18, 'Felicity Jones', '["Felicity Jones"]', 0, NULL),
  ('actors-star-wars', 19, 'Diego Luna', '["Luna"]', 0, NULL),
  ('actors-star-wars', 20, 'Pedro Pascal', '["Pascal"]', 0, NULL);

-- ── Name 10 actors who are also singers
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('actors-also-singers', 'film', 'Name 10 actors who are also singers', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('actors-also-singers', 1, 'Will Smith', '["Will Smith"]', 0, NULL),
  ('actors-also-singers', 2, 'Jared Leto', '["Leto"]', 0, NULL),
  ('actors-also-singers', 3, 'Lady Gaga', '["Gaga"]', 0, NULL),
  ('actors-also-singers', 4, 'Jennifer Lopez', '["J Lo"]', 0, NULL),
  ('actors-also-singers', 5, 'Barbra Streisand', '["Streisand"]', 0, NULL),
  ('actors-also-singers', 6, 'Cher', '["Cher"]', 0, NULL),
  ('actors-also-singers', 7, 'Mandy Moore', '["Mandy Moore"]', 0, NULL),
  ('actors-also-singers', 8, 'Hugh Jackman', '["Jackman"]', 0, NULL),
  ('actors-also-singers', 9, 'Zendaya', '["Zendaya"]', 0, NULL),
  ('actors-also-singers', 10, 'Selena Gomez', '["Selena"]', 0, NULL),
  ('actors-also-singers', 11, 'Justin Timberlake', '["Timberlake"]', 0, NULL),
  ('actors-also-singers', 12, 'Harry Styles', '["Styles"]', 0, NULL),
  ('actors-also-singers', 13, 'Donald Glover', '["Glover"]', 0, NULL),
  ('actors-also-singers', 14, 'Jamie Foxx', '["Foxx"]', 0, NULL),
  ('actors-also-singers', 15, 'Idris Elba', '["Elba"]', 0, NULL),
  ('actors-also-singers', 16, 'Jack Black', '["Jack Black"]', 0, NULL),
  ('actors-also-singers', 17, 'Ice Cube', '["Ice Cube"]', 0, NULL),
  ('actors-also-singers', 18, 'Mark Wahlberg', '["Wahlberg"]', 0, NULL);

INSERT OR IGNORE INTO tenable_rounds (category, type, params, metric, title, answer_count)
SELECT 'general', 'general', '{"round":"' || r.slug || '"}', 'none', r.title,
       (SELECT COUNT(*) FROM general_answers a WHERE a.round_slug = r.slug)
FROM general_rounds r;
