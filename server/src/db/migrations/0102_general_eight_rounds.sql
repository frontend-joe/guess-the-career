-- Eight more General rounds, all "name any ten" of a longer pool.
--
-- And the first of them that are not geography, which is what the category was
-- renamed for in 0101. The topics here — words, games, transport, culture,
-- tech, music, science — are free text, so nothing had to be taught about them.
--
-- The aliases are doing more work in this batch than in any before it, because
-- these questions are asked one way and answered another:
--
--   "A word that comes before ball" is answered "football" by half the room,
--   and they are not wrong about anything.
--
--   The Monopoly board prints "Old Kent Rd" and nobody says it, so the answers
--   are stored under the full street name with the board's abbreviation aliased.
--
--   Somebody who says "collarbone" has named the clavicle, and somebody who
--   says "sheep" has named the zodiac goat.
--
-- Rejecting an answer a player is right about is the failure that ends an
-- argument badly, on camera. Every one of these lists errs the other way.

-- ── Name 10 words that come before "ball" ─────────────────
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('words-before-ball', 'words', 'Name 10 words that come before "ball"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('words-before-ball', 1, 'Foot', '["football"]', 0, NULL),
  ('words-before-ball', 2, 'Basket', '["basketball"]', 0, NULL),
  ('words-before-ball', 3, 'Net', '["netball"]', 0, NULL),
  ('words-before-ball', 4, 'Base', '["baseball"]', 0, NULL),
  ('words-before-ball', 5, 'Volley', '["volleyball"]', 0, NULL),
  ('words-before-ball', 6, 'Hand', '["handball"]', 0, NULL),
  ('words-before-ball', 7, 'Snow', '["snowball"]', 0, NULL),
  ('words-before-ball', 8, 'Eye', '["eyeball"]', 0, NULL),
  ('words-before-ball', 9, 'Meat', '["meatball"]', 0, NULL),
  ('words-before-ball', 10, 'Paint', '["paintball"]', 0, NULL),
  ('words-before-ball', 11, 'Dodge', '["dodgeball"]', 0, NULL),
  ('words-before-ball', 12, 'Soft', '["softball"]', 0, NULL),
  ('words-before-ball', 13, 'Hair', '["hairball"]', 0, NULL),
  ('words-before-ball', 14, 'Cannon', '["cannonball"]', 0, NULL),
  ('words-before-ball', 15, 'Fire', '["fireball"]', 0, NULL),
  ('words-before-ball', 16, 'High', '["highball","high ball"]', 0, NULL);

-- ── Name 10 countries with a Mediterranean coastline ─────────────────
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('countries-mediterranean', 'countries', 'Name 10 countries with a Mediterranean coastline', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('countries-mediterranean', 1, 'Spain', NULL, 0, NULL),
  ('countries-mediterranean', 2, 'France', NULL, 0, NULL),
  ('countries-mediterranean', 3, 'Monaco', NULL, 0, NULL),
  ('countries-mediterranean', 4, 'Italy', NULL, 0, NULL),
  ('countries-mediterranean', 5, 'Malta', NULL, 0, NULL),
  ('countries-mediterranean', 6, 'Slovenia', NULL, 0, NULL),
  ('countries-mediterranean', 7, 'Croatia', NULL, 0, NULL),
  ('countries-mediterranean', 8, 'Bosnia and Herzegovina', '["Bosnia"]', 0, NULL),
  ('countries-mediterranean', 9, 'Montenegro', NULL, 0, NULL),
  ('countries-mediterranean', 10, 'Albania', NULL, 0, NULL),
  ('countries-mediterranean', 11, 'Greece', NULL, 0, NULL),
  ('countries-mediterranean', 12, 'Turkey', '["Türkiye","Turkiye"]', 0, NULL),
  ('countries-mediterranean', 13, 'Cyprus', NULL, 0, NULL),
  ('countries-mediterranean', 14, 'Syria', NULL, 0, NULL),
  ('countries-mediterranean', 15, 'Lebanon', NULL, 0, NULL),
  ('countries-mediterranean', 16, 'Israel', NULL, 0, NULL),
  ('countries-mediterranean', 17, 'Egypt', NULL, 0, NULL),
  ('countries-mediterranean', 18, 'Libya', NULL, 0, NULL),
  ('countries-mediterranean', 19, 'Tunisia', NULL, 0, NULL),
  ('countries-mediterranean', 20, 'Algeria', NULL, 0, NULL),
  ('countries-mediterranean', 21, 'Morocco', NULL, 0, NULL);

-- ── Name 10 properties on the UK Monopoly board ─────────────────
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('monopoly-uk-properties', 'games', 'Name 10 properties on the UK Monopoly board', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('monopoly-uk-properties', 1, 'Old Kent Road', '["Old Kent Rd"]', 0, NULL),
  ('monopoly-uk-properties', 2, 'Whitechapel Road', '["Whitechapel Rd"]', 0, NULL),
  ('monopoly-uk-properties', 3, 'The Angel Islington', '["Angel Islington","The Angel, Islington","Angel"]', 0, NULL),
  ('monopoly-uk-properties', 4, 'Euston Road', '["Euston Rd"]', 0, NULL),
  ('monopoly-uk-properties', 5, 'Pentonville Road', '["Pentonville Rd"]', 0, NULL),
  ('monopoly-uk-properties', 6, 'Pall Mall', NULL, 0, NULL),
  ('monopoly-uk-properties', 7, 'Whitehall', NULL, 0, NULL),
  ('monopoly-uk-properties', 8, 'Northumberland Avenue', '["Northumberland Ave"]', 0, NULL),
  ('monopoly-uk-properties', 9, 'Bow Street', '["Bow St"]', 0, NULL),
  ('monopoly-uk-properties', 10, 'Marlborough Street', '["Marlborough St","Great Marlborough Street"]', 0, NULL),
  ('monopoly-uk-properties', 11, 'Vine Street', '["Vine St"]', 0, NULL),
  ('monopoly-uk-properties', 12, 'Strand', '["The Strand"]', 0, NULL),
  ('monopoly-uk-properties', 13, 'Fleet Street', '["Fleet St"]', 0, NULL),
  ('monopoly-uk-properties', 14, 'Trafalgar Square', '["Trafalgar Sq"]', 0, NULL),
  ('monopoly-uk-properties', 15, 'Leicester Square', '["Leicester Sq"]', 0, NULL),
  ('monopoly-uk-properties', 16, 'Coventry Street', '["Coventry St"]', 0, NULL),
  ('monopoly-uk-properties', 17, 'Piccadilly', NULL, 0, NULL),
  ('monopoly-uk-properties', 18, 'Regent Street', '["Regent St"]', 0, NULL),
  ('monopoly-uk-properties', 19, 'Oxford Street', '["Oxford St"]', 0, NULL),
  ('monopoly-uk-properties', 20, 'Bond Street', '["Bond St","New Bond Street"]', 0, NULL),
  ('monopoly-uk-properties', 21, 'Park Lane', NULL, 0, NULL),
  ('monopoly-uk-properties', 22, 'Mayfair', NULL, 0, NULL);

-- ── Name 10 London Underground lines ─────────────────
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('underground-lines', 'transport', 'Name 10 London Underground lines', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('underground-lines', 1, 'Bakerloo', NULL, 0, NULL),
  ('underground-lines', 2, 'Central', NULL, 0, NULL),
  ('underground-lines', 3, 'Circle', NULL, 0, NULL),
  ('underground-lines', 4, 'District', NULL, 0, NULL),
  ('underground-lines', 5, 'Hammersmith & City', '["Hammersmith and City"]', 0, NULL),
  ('underground-lines', 6, 'Jubilee', NULL, 0, NULL),
  ('underground-lines', 7, 'Metropolitan', '["Met"]', 0, NULL),
  ('underground-lines', 8, 'Northern', NULL, 0, NULL),
  ('underground-lines', 9, 'Piccadilly', NULL, 0, NULL),
  ('underground-lines', 10, 'Victoria', NULL, 0, NULL),
  ('underground-lines', 11, 'Waterloo & City', '["Waterloo and City"]', 0, NULL);

-- ── Name 10 animals of the Chinese zodiac ─────────────────
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('chinese-zodiac', 'culture', 'Name 10 animals of the Chinese zodiac', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('chinese-zodiac', 1, 'Rat', '["Mouse"]', 0, NULL),
  ('chinese-zodiac', 2, 'Ox', '["Bull","Cow"]', 0, NULL),
  ('chinese-zodiac', 3, 'Tiger', NULL, 0, NULL),
  ('chinese-zodiac', 4, 'Rabbit', '["Hare"]', 0, NULL),
  ('chinese-zodiac', 5, 'Dragon', NULL, 0, NULL),
  ('chinese-zodiac', 6, 'Snake', NULL, 0, NULL),
  ('chinese-zodiac', 7, 'Horse', NULL, 0, NULL),
  ('chinese-zodiac', 8, 'Goat', '["Sheep","Ram"]', 0, NULL),
  ('chinese-zodiac', 9, 'Monkey', NULL, 0, NULL),
  ('chinese-zodiac', 10, 'Rooster', '["Cockerel","Chicken"]', 0, NULL),
  ('chinese-zodiac', 11, 'Dog', NULL, 0, NULL),
  ('chinese-zodiac', 12, 'Pig', '["Boar"]', 0, NULL);

-- ── Name 10 Apple products or services starting with "i" ─────────────────
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('apple-i-products', 'tech', 'Name 10 Apple products or services starting with "i"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('apple-i-products', 1, 'iPhone', NULL, 0, NULL),
  ('apple-i-products', 2, 'iPad', NULL, 0, NULL),
  ('apple-i-products', 3, 'iPod', '["iPod Touch","iPod Nano","iPod Shuffle"]', 0, NULL),
  ('apple-i-products', 4, 'iMac', NULL, 0, NULL),
  ('apple-i-products', 5, 'iTunes', NULL, 0, NULL),
  ('apple-i-products', 6, 'iCloud', NULL, 0, NULL),
  ('apple-i-products', 7, 'iBook', '["iBooks"]', 0, NULL),
  ('apple-i-products', 8, 'iMessage', NULL, 0, NULL),
  ('apple-i-products', 9, 'iMovie', NULL, 0, NULL),
  ('apple-i-products', 10, 'iPhoto', NULL, 0, NULL),
  ('apple-i-products', 11, 'iWork', '["iWorks"]', 0, NULL),
  ('apple-i-products', 12, 'iOS', NULL, 0, NULL),
  ('apple-i-products', 13, 'iPadOS', NULL, 0, NULL);

-- ── Name 10 instruments in a symphony orchestra ─────────────────
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('orchestra-instruments', 'music', 'Name 10 instruments in a symphony orchestra', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('orchestra-instruments', 1, 'Violin', NULL, 0, NULL),
  ('orchestra-instruments', 2, 'Viola', NULL, 0, NULL),
  ('orchestra-instruments', 3, 'Cello', '["Violoncello"]', 0, NULL),
  ('orchestra-instruments', 4, 'Double bass', '["Contrabass","Bass","Upright bass"]', 0, NULL),
  ('orchestra-instruments', 5, 'Harp', NULL, 0, NULL),
  ('orchestra-instruments', 6, 'Flute', NULL, 0, NULL),
  ('orchestra-instruments', 7, 'Piccolo', NULL, 0, NULL),
  ('orchestra-instruments', 8, 'Oboe', NULL, 0, NULL),
  ('orchestra-instruments', 9, 'Clarinet', NULL, 0, NULL),
  ('orchestra-instruments', 10, 'Bassoon', NULL, 0, NULL),
  ('orchestra-instruments', 11, 'Trumpet', NULL, 0, NULL),
  ('orchestra-instruments', 12, 'Trombone', NULL, 0, NULL),
  ('orchestra-instruments', 13, 'French horn', '["Horn"]', 0, NULL),
  ('orchestra-instruments', 14, 'Tuba', NULL, 0, NULL),
  ('orchestra-instruments', 15, 'Timpani', '["Kettledrums","Kettle drums"]', 0, NULL),
  ('orchestra-instruments', 16, 'Cymbals', '["Cymbal"]', 0, NULL),
  ('orchestra-instruments', 17, 'Xylophone', NULL, 0, NULL);

-- ── Name 10 bones in the human body ─────────────────
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('human-bones', 'science', 'Name 10 bones in the human body', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('human-bones', 1, 'Femur', '["Thigh bone","Thighbone"]', 0, NULL),
  ('human-bones', 2, 'Tibia', '["Shin bone","Shinbone"]', 0, NULL),
  ('human-bones', 3, 'Fibula', NULL, 0, NULL),
  ('human-bones', 4, 'Patella', '["Kneecap","Knee cap"]', 0, NULL),
  ('human-bones', 5, 'Humerus', NULL, 0, NULL),
  ('human-bones', 6, 'Radius', NULL, 0, NULL),
  ('human-bones', 7, 'Ulna', NULL, 0, NULL),
  ('human-bones', 8, 'Scapula', '["Shoulder blade"]', 0, NULL),
  ('human-bones', 9, 'Clavicle', '["Collarbone","Collar bone"]', 0, NULL),
  ('human-bones', 10, 'Sternum', '["Breastbone","Breast bone"]', 0, NULL),
  ('human-bones', 11, 'Ribs', '["Rib"]', 0, NULL),
  ('human-bones', 12, 'Pelvis', '["Hip bone","Hipbone"]', 0, NULL),
  ('human-bones', 13, 'Mandible', '["Jaw","Jawbone"]', 0, NULL),
  ('human-bones', 14, 'Cranium', '["Skull"]', 0, NULL),
  ('human-bones', 15, 'Vertebrae', '["Vertebra","Spine","Backbone"]', 0, NULL),
  ('human-bones', 16, 'Coccyx', '["Tailbone","Tail bone"]', 0, NULL),
  ('human-bones', 17, 'Metacarpals', '["Metacarpal"]', 0, NULL),
  ('human-bones', 18, 'Phalanges', '["Phalanx"]', 0, NULL);

INSERT OR IGNORE INTO tenable_rounds (category, type, params, metric, title, answer_count)
SELECT 'general', 'general', '{"round":"' || r.slug || '"}', 'none', r.title,
       (SELECT COUNT(*) FROM general_answers a WHERE a.round_slug = r.slug)
FROM general_rounds r;
