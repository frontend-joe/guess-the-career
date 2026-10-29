-- Two more Geography rounds, both "name any ten" of a long pool.
--
-- The 'land' one is deliberately generous. The eight sovereign states are the
-- spine of it, but "Islands" has a "land" inside it and somebody who spots that
-- has earned the slot, and England, Scotland, Northern Ireland, Greenland and
-- Swaziland are all going to be said out loud by somebody who can defend them.
-- An authored round can only accept or reject what is written here, and
-- rejecting an answer a player is right about is much the worse of the two
-- failures: it is the one that ends an argument badly, on camera.
--
-- Which is also why the A list runs to seventy-one rather than a tidy dozen.
-- Nobody will name them all; the point is that whichever ten somebody does name
-- are all credited. An easy round is fine. An unfair one is not.
--
-- The question this pair was meant to be was "countries ending in Y", and it is
-- not here: there are only eight (Germany, Hungary, Italy, Norway, Paraguay,
-- Turkey, Uruguay, Vatican City), which is fewer answers than the board has
-- slots.

-- ── Name 10 countries with 'land' in their name ─────────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-with-land', 'countries', 'Name 10 countries with ''land'' in their name', 0, NULL);
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-with-land', 1, 'Finland', NULL, 0, NULL),
  ('countries-with-land', 2, 'Iceland', NULL, 0, NULL),
  ('countries-with-land', 3, 'Ireland', '["Republic of Ireland","Eire"]', 0, NULL),
  ('countries-with-land', 4, 'Netherlands', '["Holland","The Netherlands"]', 0, NULL),
  ('countries-with-land', 5, 'New Zealand', NULL, 0, NULL),
  ('countries-with-land', 6, 'Poland', NULL, 0, NULL),
  ('countries-with-land', 7, 'Switzerland', NULL, 0, NULL),
  ('countries-with-land', 8, 'Thailand', NULL, 0, NULL),
  ('countries-with-land', 9, 'Marshall Islands', '["Marshall Isles"]', 0, NULL),
  ('countries-with-land', 10, 'Solomon Islands', '["Solomon Isles"]', 0, NULL),
  ('countries-with-land', 11, 'England', NULL, 0, NULL),
  ('countries-with-land', 12, 'Scotland', NULL, 0, NULL),
  ('countries-with-land', 13, 'Northern Ireland', NULL, 0, NULL),
  ('countries-with-land', 14, 'Greenland', NULL, 0, NULL),
  ('countries-with-land', 15, 'Swaziland', '["Eswatini"]', 0, NULL);

-- ── Name 10 countries ending in A ─────────────────────────────
INSERT OR IGNORE INTO geography_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-ending-a', 'countries', 'Name 10 countries ending in A', 0, NULL);
INSERT OR IGNORE INTO geography_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-ending-a', 1, 'Albania', NULL, 0, NULL),
  ('countries-ending-a', 2, 'Algeria', NULL, 0, NULL),
  ('countries-ending-a', 3, 'Andorra', NULL, 0, NULL),
  ('countries-ending-a', 4, 'Angola', NULL, 0, NULL),
  ('countries-ending-a', 5, 'Antigua and Barbuda', '["Antigua"]', 0, NULL),
  ('countries-ending-a', 6, 'Argentina', NULL, 0, NULL),
  ('countries-ending-a', 7, 'Armenia', NULL, 0, NULL),
  ('countries-ending-a', 8, 'Australia', NULL, 0, NULL),
  ('countries-ending-a', 9, 'Austria', NULL, 0, NULL),
  ('countries-ending-a', 10, 'Bolivia', NULL, 0, NULL),
  ('countries-ending-a', 11, 'Bosnia and Herzegovina', '["Bosnia"]', 0, NULL),
  ('countries-ending-a', 12, 'Botswana', NULL, 0, NULL),
  ('countries-ending-a', 13, 'Bulgaria', NULL, 0, NULL),
  ('countries-ending-a', 14, 'Cambodia', NULL, 0, NULL),
  ('countries-ending-a', 15, 'Canada', NULL, 0, NULL),
  ('countries-ending-a', 16, 'China', '["People''s Republic of China"]', 0, NULL),
  ('countries-ending-a', 17, 'Colombia', NULL, 0, NULL),
  ('countries-ending-a', 18, 'Costa Rica', NULL, 0, NULL),
  ('countries-ending-a', 19, 'Croatia', NULL, 0, NULL),
  ('countries-ending-a', 20, 'Cuba', NULL, 0, NULL),
  ('countries-ending-a', 21, 'Czechia', '["Czech Republic"]', 0, NULL),
  ('countries-ending-a', 22, 'Dominica', NULL, 0, NULL),
  ('countries-ending-a', 23, 'Equatorial Guinea', NULL, 0, NULL),
  ('countries-ending-a', 24, 'Eritrea', NULL, 0, NULL),
  ('countries-ending-a', 25, 'Estonia', NULL, 0, NULL),
  ('countries-ending-a', 26, 'Ethiopia', NULL, 0, NULL),
  ('countries-ending-a', 27, 'Gambia', '["The Gambia"]', 0, NULL),
  ('countries-ending-a', 28, 'Georgia', NULL, 0, NULL),
  ('countries-ending-a', 29, 'Ghana', NULL, 0, NULL),
  ('countries-ending-a', 30, 'Grenada', NULL, 0, NULL),
  ('countries-ending-a', 31, 'Guatemala', NULL, 0, NULL),
  ('countries-ending-a', 32, 'Guinea', NULL, 0, NULL),
  ('countries-ending-a', 33, 'Guyana', NULL, 0, NULL),
  ('countries-ending-a', 34, 'India', NULL, 0, NULL),
  ('countries-ending-a', 35, 'Indonesia', NULL, 0, NULL),
  ('countries-ending-a', 36, 'Jamaica', NULL, 0, NULL),
  ('countries-ending-a', 37, 'Kenya', NULL, 0, NULL),
  ('countries-ending-a', 38, 'Latvia', NULL, 0, NULL),
  ('countries-ending-a', 39, 'Liberia', NULL, 0, NULL),
  ('countries-ending-a', 40, 'Libya', NULL, 0, NULL),
  ('countries-ending-a', 41, 'Lithuania', NULL, 0, NULL),
  ('countries-ending-a', 42, 'Malaysia', NULL, 0, NULL),
  ('countries-ending-a', 43, 'Malta', NULL, 0, NULL),
  ('countries-ending-a', 44, 'Mauritania', NULL, 0, NULL),
  ('countries-ending-a', 45, 'Micronesia', NULL, 0, NULL),
  ('countries-ending-a', 46, 'Moldova', NULL, 0, NULL),
  ('countries-ending-a', 47, 'Mongolia', NULL, 0, NULL),
  ('countries-ending-a', 48, 'Namibia', NULL, 0, NULL),
  ('countries-ending-a', 49, 'Nicaragua', NULL, 0, NULL),
  ('countries-ending-a', 50, 'Nigeria', NULL, 0, NULL),
  ('countries-ending-a', 51, 'North Macedonia', '["Macedonia"]', 0, NULL),
  ('countries-ending-a', 52, 'Panama', NULL, 0, NULL),
  ('countries-ending-a', 53, 'Papua New Guinea', NULL, 0, NULL),
  ('countries-ending-a', 54, 'Romania', NULL, 0, NULL),
  ('countries-ending-a', 55, 'Russia', '["Russian Federation"]', 0, NULL),
  ('countries-ending-a', 56, 'Rwanda', NULL, 0, NULL),
  ('countries-ending-a', 57, 'Saint Lucia', '["St Lucia"]', 0, NULL),
  ('countries-ending-a', 58, 'Samoa', NULL, 0, NULL),
  ('countries-ending-a', 59, 'Saudi Arabia', NULL, 0, NULL),
  ('countries-ending-a', 60, 'Serbia', NULL, 0, NULL),
  ('countries-ending-a', 61, 'Slovakia', NULL, 0, NULL),
  ('countries-ending-a', 62, 'Slovenia', NULL, 0, NULL),
  ('countries-ending-a', 63, 'Somalia', NULL, 0, NULL),
  ('countries-ending-a', 64, 'South Africa', NULL, 0, NULL),
  ('countries-ending-a', 65, 'Sri Lanka', NULL, 0, NULL),
  ('countries-ending-a', 66, 'Syria', NULL, 0, NULL),
  ('countries-ending-a', 67, 'Tanzania', NULL, 0, NULL),
  ('countries-ending-a', 68, 'Tonga', NULL, 0, NULL),
  ('countries-ending-a', 69, 'Tunisia', NULL, 0, NULL),
  ('countries-ending-a', 70, 'Uganda', NULL, 0, NULL),
  ('countries-ending-a', 71, 'Venezuela', NULL, 0, NULL),
  ('countries-ending-a', 72, 'Zambia', NULL, 0, NULL);

INSERT OR IGNORE INTO tenable_rounds (category, type, params, metric, title, answer_count)
SELECT 'geography', 'geography', '{"round":"' || r.slug || '"}', 'none', r.title,
       (SELECT COUNT(*) FROM geography_answers a WHERE a.round_slug = r.slug)
FROM geography_rounds r;
