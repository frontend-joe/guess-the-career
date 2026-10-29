-- Ten more Geography rounds.
--
-- Same shape as 0097: the round, its answers, and the registry row that is how
-- the rest of Tenable knows a round exists. Seeded rather than typed into the
-- admin so a fresh database — and production on the next deploy — comes up with
-- the whole set rather than whichever half somebody got round to re-entering.
--
-- Three of these are "name any ten" of a longer pool, which is the shape the
-- World Cup squad rounds use: twelve to seventeen correct answers and ten
-- slots, so no two games of it play the same way.
--
-- One of them counts UP. A ranked round shows the order it is written in, so
-- "the ten smallest countries" needs no special case — it is simply authored
-- smallest first.

-- ── The 10 most populated countries in the world ──────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-most-populated', 'countries', 'The 10 most populated countries in the world', 1, 'people');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-most-populated', 1, 'India', NULL, 1428600000, '1,429m'),
  ('countries-most-populated', 2, 'China', '["People''s Republic of China"]', 1425700000, '1,426m'),
  ('countries-most-populated', 3, 'United States', '["USA","US","America","United States of America"]', 339900000, '340m'),
  ('countries-most-populated', 4, 'Indonesia', NULL, 277500000, '278m'),
  ('countries-most-populated', 5, 'Pakistan', NULL, 240500000, '240m'),
  ('countries-most-populated', 6, 'Nigeria', NULL, 223800000, '224m'),
  ('countries-most-populated', 7, 'Brazil', NULL, 216400000, '216m'),
  ('countries-most-populated', 8, 'Bangladesh', NULL, 173000000, '173m'),
  ('countries-most-populated', 9, 'Russia', '["Russian Federation"]', 144400000, '144m'),
  ('countries-most-populated', 10, 'Mexico', NULL, 128500000, '128m');

-- ── The 10 most populated countries in the European Union ─────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('eu-most-populated', 'countries', 'The 10 most populated countries in the European Union', 1, 'people');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('eu-most-populated', 1, 'Germany', NULL, 83500000, '83.5m'),
  ('eu-most-populated', 2, 'France', NULL, 68200000, '68.2m'),
  ('eu-most-populated', 3, 'Italy', NULL, 58900000, '58.9m'),
  ('eu-most-populated', 4, 'Spain', NULL, 48300000, '48.3m'),
  ('eu-most-populated', 5, 'Poland', NULL, 36700000, '36.7m'),
  ('eu-most-populated', 6, 'Romania', NULL, 19000000, '19.0m'),
  ('eu-most-populated', 7, 'Netherlands', '["Holland"]', 17900000, '17.9m'),
  ('eu-most-populated', 8, 'Belgium', NULL, 11700000, '11.7m'),
  ('eu-most-populated', 9, 'Czechia', '["Czech Republic"]', 10900000, '10.9m'),
  ('eu-most-populated', 10, 'Sweden', NULL, 10500000, '10.5m');

-- ── The 10 most populated US states ───────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('us-states-most-populated', 'states', 'The 10 most populated US states', 1, 'people');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-states-most-populated', 1, 'California', NULL, 38965000, '39.0m'),
  ('us-states-most-populated', 2, 'Texas', NULL, 30503000, '30.5m'),
  ('us-states-most-populated', 3, 'Florida', NULL, 22611000, '22.6m'),
  ('us-states-most-populated', 4, 'New York', '["New York State"]', 19571000, '19.6m'),
  ('us-states-most-populated', 5, 'Pennsylvania', NULL, 12961000, '13.0m'),
  ('us-states-most-populated', 6, 'Illinois', NULL, 12549000, '12.5m'),
  ('us-states-most-populated', 7, 'Ohio', NULL, 11785000, '11.8m'),
  ('us-states-most-populated', 8, 'Georgia', NULL, 11029000, '11.0m'),
  ('us-states-most-populated', 9, 'North Carolina', NULL, 10835000, '10.8m'),
  ('us-states-most-populated', 10, 'Michigan', NULL, 10037000, '10.0m');

-- ── The 10 largest countries in Africa by area ────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-africa-largest', 'countries', 'The 10 largest countries in Africa by area', 1, 'km²');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-africa-largest', 1, 'Algeria', NULL, 2381741, '2.38m'),
  ('countries-africa-largest', 2, 'DR Congo', '["Democratic Republic of the Congo","DRC","Congo-Kinshasa","Zaire"]', 2344858, '2.34m'),
  ('countries-africa-largest', 3, 'Sudan', NULL, 1861484, '1.86m'),
  ('countries-africa-largest', 4, 'Libya', NULL, 1759540, '1.76m'),
  ('countries-africa-largest', 5, 'Chad', NULL, 1284000, '1.28m'),
  ('countries-africa-largest', 6, 'Niger', NULL, 1267000, '1.27m'),
  ('countries-africa-largest', 7, 'Angola', NULL, 1246700, '1.25m'),
  ('countries-africa-largest', 8, 'Mali', NULL, 1240192, '1.24m'),
  ('countries-africa-largest', 9, 'South Africa', NULL, 1221037, '1.22m'),
  ('countries-africa-largest', 10, 'Ethiopia', NULL, 1104300, '1.10m');

-- ── The 10 smallest countries in the world by area ────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-smallest', 'countries', 'The 10 smallest countries in the world by area', 1, 'km²');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-smallest', 1, 'Vatican City', '["Vatican","Holy See"]', 0.49, '0.49'),
  ('countries-smallest', 2, 'Monaco', NULL, 2.02, '2.0'),
  ('countries-smallest', 3, 'Nauru', NULL, 21, '21'),
  ('countries-smallest', 4, 'Tuvalu', NULL, 26, '26'),
  ('countries-smallest', 5, 'San Marino', NULL, 61, '61'),
  ('countries-smallest', 6, 'Liechtenstein', NULL, 160, '160'),
  ('countries-smallest', 7, 'Marshall Islands', NULL, 181, '181'),
  ('countries-smallest', 8, 'Saint Kitts and Nevis', '["St Kitts and Nevis","St Kitts"]', 261, '261'),
  ('countries-smallest', 9, 'Maldives', NULL, 300, '300'),
  ('countries-smallest', 10, 'Malta', NULL, 316, '316');

-- ── The 10 longest rivers in Europe ───────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('rivers-europe-longest', 'rivers', 'The 10 longest rivers in Europe', 1, 'km');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('rivers-europe-longest', 1, 'Volga', NULL, 3531, '3,531'),
  ('rivers-europe-longest', 2, 'Danube', '["Donau"]', 2850, '2,850'),
  ('rivers-europe-longest', 3, 'Ural', NULL, 2428, '2,428'),
  ('rivers-europe-longest', 4, 'Dnieper', '["Dnipro"]', 2201, '2,201'),
  ('rivers-europe-longest', 5, 'Don', NULL, 1870, '1,870'),
  ('rivers-europe-longest', 6, 'Pechora', NULL, 1809, '1,809'),
  ('rivers-europe-longest', 7, 'Kama', NULL, 1805, '1,805'),
  ('rivers-europe-longest', 8, 'Oka', NULL, 1500, '1,500'),
  ('rivers-europe-longest', 9, 'Belaya', NULL, 1430, '1,430'),
  ('rivers-europe-longest', 10, 'Dniester', NULL, 1352, '1,352');

-- ── The 10 largest deserts in the world ───────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('deserts-largest', 'deserts', 'The 10 largest deserts in the world', 1, 'km²');
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('deserts-largest', 1, 'Antarctic Desert', '["Antarctic","Antarctica"]', 14200000, '14.2m'),
  ('deserts-largest', 2, 'Arctic Desert', '["Arctic"]', 13900000, '13.9m'),
  ('deserts-largest', 3, 'Sahara', '["Sahara Desert"]', 9200000, '9.2m'),
  ('deserts-largest', 4, 'Arabian Desert', '["Arabian"]', 2330000, '2.33m'),
  ('deserts-largest', 5, 'Gobi', '["Gobi Desert"]', 1295000, '1.30m'),
  ('deserts-largest', 6, 'Kalahari', '["Kalahari Desert"]', 900000, '900,000'),
  ('deserts-largest', 7, 'Patagonian Desert', '["Patagonian","Patagonia"]', 673000, '673,000'),
  ('deserts-largest', 8, 'Syrian Desert', '["Syrian"]', 520000, '520,000'),
  ('deserts-largest', 9, 'Great Basin Desert', '["Great Basin"]', 492000, '492,000'),
  ('deserts-largest', 10, 'Chihuahuan Desert', '["Chihuahuan"]', 455000, '455,000');

-- ── Name 10 countries beginning with B ────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-b', 'countries', 'Name 10 countries beginning with B', 0, NULL);
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-b', 1, 'Bahamas', '["The Bahamas"]', 0, NULL),
  ('countries-b', 2, 'Bahrain', NULL, 0, NULL),
  ('countries-b', 3, 'Bangladesh', NULL, 0, NULL),
  ('countries-b', 4, 'Barbados', NULL, 0, NULL),
  ('countries-b', 5, 'Belarus', NULL, 0, NULL),
  ('countries-b', 6, 'Belgium', NULL, 0, NULL),
  ('countries-b', 7, 'Belize', NULL, 0, NULL),
  ('countries-b', 8, 'Benin', NULL, 0, NULL),
  ('countries-b', 9, 'Bhutan', NULL, 0, NULL),
  ('countries-b', 10, 'Bolivia', NULL, 0, NULL),
  ('countries-b', 11, 'Bosnia and Herzegovina', '["Bosnia"]', 0, NULL),
  ('countries-b', 12, 'Botswana', NULL, 0, NULL),
  ('countries-b', 13, 'Brazil', NULL, 0, NULL),
  ('countries-b', 14, 'Brunei', NULL, 0, NULL),
  ('countries-b', 15, 'Bulgaria', NULL, 0, NULL),
  ('countries-b', 16, 'Burkina Faso', NULL, 0, NULL),
  ('countries-b', 17, 'Burundi', NULL, 0, NULL);

-- ── Name 10 landlocked countries in Africa ────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-landlocked-africa', 'countries', 'Name 10 landlocked countries in Africa', 0, NULL);
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-landlocked-africa', 1, 'Botswana', NULL, 0, NULL),
  ('countries-landlocked-africa', 2, 'Burkina Faso', NULL, 0, NULL),
  ('countries-landlocked-africa', 3, 'Burundi', NULL, 0, NULL),
  ('countries-landlocked-africa', 4, 'Central African Republic', '["CAR"]', 0, NULL),
  ('countries-landlocked-africa', 5, 'Chad', NULL, 0, NULL),
  ('countries-landlocked-africa', 6, 'Eswatini', '["Swaziland"]', 0, NULL),
  ('countries-landlocked-africa', 7, 'Ethiopia', NULL, 0, NULL),
  ('countries-landlocked-africa', 8, 'Lesotho', NULL, 0, NULL),
  ('countries-landlocked-africa', 9, 'Malawi', NULL, 0, NULL),
  ('countries-landlocked-africa', 10, 'Mali', NULL, 0, NULL),
  ('countries-landlocked-africa', 11, 'Niger', NULL, 0, NULL),
  ('countries-landlocked-africa', 12, 'Rwanda', NULL, 0, NULL),
  ('countries-landlocked-africa', 13, 'South Sudan', NULL, 0, NULL),
  ('countries-landlocked-africa', 14, 'Uganda', NULL, 0, NULL),
  ('countries-landlocked-africa', 15, 'Zambia', NULL, 0, NULL),
  ('countries-landlocked-africa', 16, 'Zimbabwe', NULL, 0, NULL);

-- ── Name 10 capital cities beginning with S ───────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('capitals-s', 'capitals', 'Name 10 capital cities beginning with S', 0, NULL);
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('capitals-s', 1, 'Sanaa', '["Sana''a"]', 0, NULL),
  ('capitals-s', 2, 'San José', '["San Jose"]', 0, NULL),
  ('capitals-s', 3, 'San Marino', NULL, 0, NULL),
  ('capitals-s', 4, 'San Salvador', NULL, 0, NULL),
  ('capitals-s', 5, 'Santiago', NULL, 0, NULL),
  ('capitals-s', 6, 'Santo Domingo', NULL, 0, NULL),
  ('capitals-s', 7, 'Sarajevo', NULL, 0, NULL),
  ('capitals-s', 8, 'Seoul', NULL, 0, NULL),
  ('capitals-s', 9, 'Singapore', NULL, 0, NULL),
  ('capitals-s', 10, 'Skopje', NULL, 0, NULL),
  ('capitals-s', 11, 'Sofia', NULL, 0, NULL),
  ('capitals-s', 12, 'Stockholm', NULL, 0, NULL),
  ('capitals-s', 13, 'Sucre', NULL, 0, NULL),
  ('capitals-s', 14, 'Suva', NULL, 0, NULL),
  ('capitals-s', 15, 'Saint George''s', '["St George''s","Saint Georges"]', 0, NULL),
  ('capitals-s', 16, 'Saint John''s', '["St John''s","Saint Johns"]', 0, NULL);

-- The registry rows, for the rounds above that do not have one yet.
INSERT OR IGNORE INTO tenable_rounds (category, type, params, metric, title, answer_count)
SELECT 'geography', 'geography', '{"round":"' || r.slug || '"}', 'none', r.title,
       (SELECT COUNT(*) FROM geography_answers a WHERE a.round_slug = r.slug)
FROM geography_rounds r;
