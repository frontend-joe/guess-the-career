-- Fifty rounds of judgement rather than fact.
--
-- Every round before this one had an answer you could look up. These do not.
-- There is no authority on the excuses for being late to work: the list is a
-- dozen good ones, not every one that exists, and the first time somebody says
-- "my phone updated overnight" the game either agrees with them or spends the
-- next minute arguing with a database — which, on camera, is the whole episode.
--
-- So these ship alongside the host's override (allowGuess): the list is a
-- starting point and the host has the final say. That changes what the aliases
-- are FOR. On a factual round they are the other true name of a fixed thing —
-- the Huang He is the Yellow River. Here they are the short way somebody
-- actually says it, because nobody recites "Couldn't find my keys", they say
-- "keys". Every answer that is a sentence carries the two or three words it
-- gets shortened to in a real room.
--
-- Six of the supplied lists had exactly ten answers, which makes "name any ten"
-- into "name all ten" — a different and much harder game. Those are longer
-- here, which is the one liberty taken with the content.

-- ── Name 10 excuses for being late to work
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('late-to-work-excuses', 'life', 'Name 10 excuses for being late to work', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('late-to-work-excuses', 1, 'Traffic', '["traffic was bad","the traffic"]', 0, NULL),
  ('late-to-work-excuses', 2, 'Alarm didn''t go off', '["alarm","my alarm didnt go off","slept through my alarm"]', 0, NULL),
  ('late-to-work-excuses', 3, 'Train cancelled', '["train","trains","train was cancelled","train delayed"]', 0, NULL),
  ('late-to-work-excuses', 4, 'Dog was sick', '["dog","the dog was sick"]', 0, NULL),
  ('late-to-work-excuses', 5, 'Couldn''t find my keys', '["keys","lost my keys","couldnt find keys"]', 0, NULL),
  ('late-to-work-excuses', 6, 'Roadworks', '["road works"]', 0, NULL),
  ('late-to-work-excuses', 7, 'Flat tyre', '["puncture","flat tire"]', 0, NULL),
  ('late-to-work-excuses', 8, 'Overslept', '["slept in"]', 0, NULL),
  ('late-to-work-excuses', 9, 'The kids', '["kids","children","school run"]', 0, NULL),
  ('late-to-work-excuses', 10, 'Locked out', '["locked myself out"]', 0, NULL),
  ('late-to-work-excuses', 11, 'Stuck behind a tractor', '["tractor"]', 0, NULL),
  ('late-to-work-excuses', 12, 'Power cut', '["power was out"]', 0, NULL);

-- ── Name 10 things you find down the back of the sofa
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('down-back-of-sofa', 'life', 'Name 10 things you find down the back of the sofa', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('down-back-of-sofa', 1, 'Coins', '["coin","loose change","change","money"]', 0, NULL),
  ('down-back-of-sofa', 2, 'The remote', '["remote","remote control"]', 0, NULL),
  ('down-back-of-sofa', 3, 'Crumbs', NULL, 0, NULL),
  ('down-back-of-sofa', 4, 'Crisps', '["a crisp"]', 0, NULL),
  ('down-back-of-sofa', 5, 'Hair bobble', '["hairband","bobble","hair tie"]', 0, NULL),
  ('down-back-of-sofa', 6, 'A pen', '["pen","biro"]', 0, NULL),
  ('down-back-of-sofa', 7, 'A sock', '["sock","socks"]', 0, NULL),
  ('down-back-of-sofa', 8, 'Lego', '["a bit of lego"]', 0, NULL),
  ('down-back-of-sofa', 9, 'A phone', '["phone","mobile"]', 0, NULL),
  ('down-back-of-sofa', 10, 'Sweet wrapper', '["wrapper","sweet wrappers"]', 0, NULL),
  ('down-back-of-sofa', 11, 'Keys', '["a key"]', 0, NULL),
  ('down-back-of-sofa', 12, 'Popcorn', NULL, 0, NULL),
  ('down-back-of-sofa', 13, 'An earring', '["earring","earrings"]', 0, NULL),
  ('down-back-of-sofa', 14, 'A receipt', '["receipt","receipts"]', 0, NULL);

-- ── Name 10 real UK place names that sound funny
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('funny-uk-place-names', 'places', 'Name 10 real UK place names that sound funny', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('funny-uk-place-names', 1, 'Scratchy Bottom', NULL, 0, NULL),
  ('funny-uk-place-names', 2, 'Wetwang', NULL, 0, NULL),
  ('funny-uk-place-names', 3, 'Great Snoring', NULL, 0, NULL),
  ('funny-uk-place-names', 4, 'Little Snoring', NULL, 0, NULL),
  ('funny-uk-place-names', 5, 'Pity Me', NULL, 0, NULL),
  ('funny-uk-place-names', 6, 'Nether Wallop', NULL, 0, NULL),
  ('funny-uk-place-names', 7, 'Giggleswick', NULL, 0, NULL),
  ('funny-uk-place-names', 8, 'Ugley', NULL, 0, NULL),
  ('funny-uk-place-names', 9, 'Upper Dicker', NULL, 0, NULL),
  ('funny-uk-place-names', 10, 'Westward Ho!', '["westward ho"]', 0, NULL),
  ('funny-uk-place-names', 11, 'Booze', NULL, 0, NULL),
  ('funny-uk-place-names', 12, 'Crapstone', NULL, 0, NULL),
  ('funny-uk-place-names', 13, 'Netherthong', NULL, 0, NULL),
  ('funny-uk-place-names', 14, 'Penistone', NULL, 0, NULL);

-- ── Name 10 things people lie about on dating profiles
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('dating-profile-lies', 'life', 'Name 10 things people lie about on dating profiles', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('dating-profile-lies', 1, 'Height', '["how tall they are","their height"]', 0, NULL),
  ('dating-profile-lies', 2, 'Age', '["their age"]', 0, NULL),
  ('dating-profile-lies', 3, 'Job', '["their job","what they do"]', 0, NULL),
  ('dating-profile-lies', 4, 'Weight', '["their weight"]', 0, NULL),
  ('dating-profile-lies', 5, 'Photos', '["photo","old photos","their pictures","pictures"]', 0, NULL),
  ('dating-profile-lies', 6, 'Salary', '["money","how much they earn"]', 0, NULL),
  ('dating-profile-lies', 7, '"Loves hiking"', '["hiking","loves hiking","likes hiking"]', 0, NULL),
  ('dating-profile-lies', 8, '"Reads books"', '["reading","reads books","books"]', 0, NULL),
  ('dating-profile-lies', 9, '"Goes to the gym"', '["gym","goes to the gym"]', 0, NULL),
  ('dating-profile-lies', 10, 'Relationship status', '["being single","whether theyre single"]', 0, NULL),
  ('dating-profile-lies', 11, 'Having no kids', '["kids","children","no kids"]', 0, NULL),
  ('dating-profile-lies', 12, '"Laid back"', '["laid back","being laid back"]', 0, NULL),
  ('dating-profile-lies', 13, 'Liking dogs', '["dogs","likes dogs"]', 0, NULL);

-- ── Name 10 things your mum always says
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('things-your-mum-says', 'life', 'Name 10 things your mum always says', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('things-your-mum-says', 1, 'Money doesn''t grow on trees', '["money doesnt grow on trees"]', 0, NULL),
  ('things-your-mum-says', 2, 'Because I said so', NULL, 0, NULL),
  ('things-your-mum-says', 3, 'Ask your dad', NULL, 0, NULL),
  ('things-your-mum-says', 4, 'Were you born in a barn?', '["were you born in a barn","born in a barn"]', 0, NULL),
  ('things-your-mum-says', 5, 'Wear a coat', '["take a coat","youll catch your death"]', 0, NULL),
  ('things-your-mum-says', 6, 'Who''s going to eat all this?', '["whos going to eat all this","whos eating all this"]', 0, NULL),
  ('things-your-mum-says', 7, 'I''m not a taxi', '["im not a taxi","do i look like a taxi"]', 0, NULL),
  ('things-your-mum-says', 8, 'Shut the door', '["close the door"]', 0, NULL),
  ('things-your-mum-says', 9, 'I won''t ask again', '["im not going to ask again","i wont ask again"]', 0, NULL),
  ('things-your-mum-says', 10, 'We''ve got food at home', '["weve got food at home","theres food at home"]', 0, NULL),
  ('things-your-mum-says', 11, 'Don''t make me come up there', '["dont make me come up there"]', 0, NULL),
  ('things-your-mum-says', 12, 'I''m not made of money', '["im not made of money"]', 0, NULL),
  ('things-your-mum-says', 13, 'Have you tidied your room?', '["have you tidied your room","tidy your room"]', 0, NULL),
  ('things-your-mum-says', 14, 'You''re not going out dressed like that', '["youre not going out dressed like that","not dressed like that"]', 0, NULL),
  ('things-your-mum-says', 15, 'Close the fridge', '["shut the fridge"]', 0, NULL);

-- ── Name 10 things dads do on holiday
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('dads-on-holiday', 'life', 'Name 10 things dads do on holiday', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('dads-on-holiday', 1, 'Wear socks with sandals', '["socks and sandals","socks with sandals"]', 0, NULL),
  ('dads-on-holiday', 2, 'Check the passports 50 times', '["check the passports","passports"]', 0, NULL),
  ('dads-on-holiday', 3, 'Get sunburnt', '["sunburn","burn"]', 0, NULL),
  ('dads-on-holiday', 4, 'Find the cheapest car park', '["cheapest car park","park miles away"]', 0, NULL),
  ('dads-on-holiday', 5, 'Film everything', '["videos everything","camera"]', 0, NULL),
  ('dads-on-holiday', 6, 'Read the map wrong', '["get lost","map"]', 0, NULL),
  ('dads-on-holiday', 7, 'Insist on leaving early', '["leave early","airport five hours early"]', 0, NULL),
  ('dads-on-holiday', 8, 'Chat to the locals', '["chat to locals","talk to locals"]', 0, NULL),
  ('dads-on-holiday', 9, 'Fall asleep by the pool', '["asleep by the pool","nap by the pool"]', 0, NULL),
  ('dads-on-holiday', 10, 'Haggle', '["haggling","barter"]', 0, NULL),
  ('dads-on-holiday', 11, 'Complain about the price of the drinks', '["complain about the prices","the price of a pint out here"]', 0, NULL),
  ('dads-on-holiday', 12, 'Put a towel on a sunbed', '["towel on the sunbeds","claim the sunbeds","sunbeds"]', 0, NULL),
  ('dads-on-holiday', 13, 'Count the luggage', '["count the bags","check the bags"]', 0, NULL),
  ('dads-on-holiday', 14, 'Talk about the drive home', '["plan the route home","talk about the journey back"]', 0, NULL);

-- ── Name 10 bad places to sneeze
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('bad-places-to-sneeze', 'life', 'Name 10 bad places to sneeze', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('bad-places-to-sneeze', 1, 'A library', '["library"]', 0, NULL),
  ('bad-places-to-sneeze', 2, 'A funeral', '["funeral"]', 0, NULL),
  ('bad-places-to-sneeze', 3, 'Wedding vows', '["a wedding","wedding"]', 0, NULL),
  ('bad-places-to-sneeze', 4, 'An exam hall', '["exam","exam hall","an exam"]', 0, NULL),
  ('bad-places-to-sneeze', 5, 'Surgery', '["an operation","in surgery"]', 0, NULL),
  ('bad-places-to-sneeze', 6, 'On a date', '["a date"]', 0, NULL),
  ('bad-places-to-sneeze', 7, 'A job interview', '["job interview","interview"]', 0, NULL),
  ('bad-places-to-sneeze', 8, 'The cinema', '["cinema","a cinema"]', 0, NULL),
  ('bad-places-to-sneeze', 9, 'A sniper''s nest', '["snipers nest","sniping"]', 0, NULL),
  ('bad-places-to-sneeze', 10, 'Near a birthday cake', '["birthday cake","over a cake"]', 0, NULL),
  ('bad-places-to-sneeze', 11, 'An eye test', '["eye test","the opticians"]', 0, NULL),
  ('bad-places-to-sneeze', 12, 'Hide and seek', '["hide-and-seek","playing hide and seek"]', 0, NULL);

-- ── Name 10 things a cat knocks off a table
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('cat-knocks-off-table', 'life', 'Name 10 things a cat knocks off a table', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('cat-knocks-off-table', 1, 'A glass of water', '["glass of water","a glass","water"]', 0, NULL),
  ('cat-knocks-off-table', 2, 'A phone', '["phone"]', 0, NULL),
  ('cat-knocks-off-table', 3, 'A pen', '["pen","pens"]', 0, NULL),
  ('cat-knocks-off-table', 4, 'Keys', '["a key"]', 0, NULL),
  ('cat-knocks-off-table', 5, 'A mug', '["mug","cup of tea","a cup"]', 0, NULL),
  ('cat-knocks-off-table', 6, 'The remote', '["remote","remote control"]', 0, NULL),
  ('cat-knocks-off-table', 7, 'A plant pot', '["plant","plant pot","a plant"]', 0, NULL),
  ('cat-knocks-off-table', 8, 'Glasses', '["specs","reading glasses"]', 0, NULL),
  ('cat-knocks-off-table', 9, 'A candle', '["candle","candles"]', 0, NULL),
  ('cat-knocks-off-table', 10, 'Christmas baubles', '["baubles","bauble","the tree"]', 0, NULL),
  ('cat-knocks-off-table', 11, 'Food', '["dinner","a plate"]', 0, NULL),
  ('cat-knocks-off-table', 12, 'Earrings', '["an earring","jewellery"]', 0, NULL);

-- ── Name 10 things in a kitchen junk drawer
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('kitchen-junk-drawer', 'life', 'Name 10 things in a kitchen junk drawer', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('kitchen-junk-drawer', 1, 'Batteries', '["a battery","dead batteries"]', 0, NULL),
  ('kitchen-junk-drawer', 2, 'Takeaway menus', '["menus","takeaway menu"]', 0, NULL),
  ('kitchen-junk-drawer', 3, 'Rubber bands', '["elastic bands","rubber band"]', 0, NULL),
  ('kitchen-junk-drawer', 4, 'Sellotape', '["tape","sticky tape"]', 0, NULL),
  ('kitchen-junk-drawer', 5, 'Scissors', '["a pair of scissors"]', 0, NULL),
  ('kitchen-junk-drawer', 6, 'Birthday candles', '["candles","cake candles"]', 0, NULL),
  ('kitchen-junk-drawer', 7, 'Spare keys', '["keys","a key that fits nothing"]', 0, NULL),
  ('kitchen-junk-drawer', 8, 'An old charger', '["charger","chargers","old cables","cables"]', 0, NULL),
  ('kitchen-junk-drawer', 9, 'A tape measure', '["tape measure"]', 0, NULL),
  ('kitchen-junk-drawer', 10, 'Matches', '["a box of matches"]', 0, NULL),
  ('kitchen-junk-drawer', 11, 'Takeaway sauces', '["sauce sachets","ketchup sachets","soy sauce"]', 0, NULL),
  ('kitchen-junk-drawer', 12, 'Allen keys', '["an allen key"]', 0, NULL),
  ('kitchen-junk-drawer', 13, 'A screwdriver', '["screwdriver"]', 0, NULL),
  ('kitchen-junk-drawer', 14, 'String', '["bit of string"]', 0, NULL);

-- ── Name 10 things a toddler puts in their mouth
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('toddler-mouth', 'life', 'Name 10 things a toddler puts in their mouth', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('toddler-mouth', 1, 'Lego', '["a brick","lego brick"]', 0, NULL),
  ('toddler-mouth', 2, 'Sand', NULL, 0, NULL),
  ('toddler-mouth', 3, 'Crayons', '["a crayon"]', 0, NULL),
  ('toddler-mouth', 4, 'Keys', '["a key"]', 0, NULL),
  ('toddler-mouth', 5, 'The remote', '["remote","remote control"]', 0, NULL),
  ('toddler-mouth', 6, 'Coins', '["a coin","money"]', 0, NULL),
  ('toddler-mouth', 7, 'Mud', '["dirt","soil"]', 0, NULL),
  ('toddler-mouth', 8, 'The dog''s toy', '["dog toy","the dogs toy","dogs toy"]', 0, NULL),
  ('toddler-mouth', 9, 'Shoes', '["a shoe"]', 0, NULL),
  ('toddler-mouth', 10, 'Soap', NULL, 0, NULL),
  ('toddler-mouth', 11, 'Paper', '["a book","cardboard"]', 0, NULL),
  ('toddler-mouth', 12, 'A phone', '["phone"]', 0, NULL),
  ('toddler-mouth', 13, 'A slug', '["slug","a snail","worm"]', 0, NULL);

-- ── Name 10 things a seagull will steal
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('seagull-steals', 'life', 'Name 10 things a seagull will steal', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('seagull-steals', 1, 'Chips', '["a chip","your chips"]', 0, NULL),
  ('seagull-steals', 2, 'Ice cream', '["a 99","an ice cream"]', 0, NULL),
  ('seagull-steals', 3, 'A sausage roll', '["sausage roll","greggs"]', 0, NULL),
  ('seagull-steals', 4, 'A sandwich', '["sandwich","your sarnie","sarnie"]', 0, NULL),
  ('seagull-steals', 5, 'A pasty', '["pasty","cornish pasty"]', 0, NULL),
  ('seagull-steals', 6, 'A doughnut', '["doughnut","donut"]', 0, NULL),
  ('seagull-steals', 7, 'Crisps', '["a crisp","bag of crisps"]', 0, NULL),
  ('seagull-steals', 8, 'A burger', '["burger"]', 0, NULL),
  ('seagull-steals', 9, 'A hot dog', '["hot dog"]', 0, NULL),
  ('seagull-steals', 10, 'Fish', '["your fish","fish and chips"]', 0, NULL),
  ('seagull-steals', 11, 'A battered sausage', '["battered sausage"]', 0, NULL),
  ('seagull-steals', 12, 'Sunglasses', '["your sunglasses"]', 0, NULL);

-- ── Name 10 things you say when you forget someone's name
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('forgot-your-name', 'life', 'Name 10 things you say when you forget someone''s name', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('forgot-your-name', 1, 'Mate', NULL, 0, NULL),
  ('forgot-your-name', 2, 'Pal', NULL, 0, NULL),
  ('forgot-your-name', 3, 'Buddy', '["bud"]', 0, NULL),
  ('forgot-your-name', 4, 'Chief', NULL, 0, NULL),
  ('forgot-your-name', 5, 'Boss', NULL, 0, NULL),
  ('forgot-your-name', 6, 'Hun', '["hunny"]', 0, NULL),
  ('forgot-your-name', 7, 'Love', NULL, 0, NULL),
  ('forgot-your-name', 8, 'Legend', NULL, 0, NULL),
  ('forgot-your-name', 9, 'Big man', NULL, 0, NULL),
  ('forgot-your-name', 10, 'My friend', NULL, 0, NULL),
  ('forgot-your-name', 11, 'Champ', NULL, 0, NULL),
  ('forgot-your-name', 12, 'Sweetheart', NULL, 0, NULL),
  ('forgot-your-name', 13, 'Hey you!', '["hey you"]', 0, NULL);

-- ── Name 10 things a self-checkout says
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('self-checkout-says', 'life', 'Name 10 things a self-checkout says', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('self-checkout-says', 1, 'Unexpected item in bagging area', '["unexpected item"]', 0, NULL),
  ('self-checkout-says', 2, 'Please place the item in the bagging area', '["please place item in the bagging area","place the item in the bagging area"]', 0, NULL),
  ('self-checkout-says', 3, 'Approval needed', '["waiting for approval","approval required"]', 0, NULL),
  ('self-checkout-says', 4, 'Please wait for assistance', '["wait for assistance","assistance required"]', 0, NULL),
  ('self-checkout-says', 5, 'Remove the item', '["remove item","please remove the item"]', 0, NULL),
  ('self-checkout-says', 6, 'Have you scanned your bag?', '["have you scanned your bag","do you have your own bag"]', 0, NULL),
  ('self-checkout-says', 7, 'Please scan your first item', '["scan your first item","scan an item to begin"]', 0, NULL),
  ('self-checkout-says', 8, 'Please insert cash', '["insert cash","insert coins"]', 0, NULL),
  ('self-checkout-says', 9, 'Thank you for shopping with us', '["thank you for shopping"]', 0, NULL),
  ('self-checkout-says', 10, 'Card payment declined', '["payment declined","declined"]', 0, NULL),
  ('self-checkout-says', 11, 'Please take your items', '["take your items","dont forget your items"]', 0, NULL),
  ('self-checkout-says', 12, 'Do you have a loyalty card?', '["do you have a loyalty card","any loyalty cards"]', 0, NULL),
  ('self-checkout-says', 13, 'Help is on its way', '["help is on the way","someone is coming to help"]', 0, NULL),
  ('self-checkout-says', 14, 'Item not recognised', '["unrecognised item","item not found"]', 0, NULL);

-- ── Name 10 animals with silly names
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('silly-animal-names', 'nature', 'Name 10 animals with silly names', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('silly-animal-names', 1, 'Blobfish', NULL, 0, NULL),
  ('silly-animal-names', 2, 'Aye-aye', '["aye aye"]', 0, NULL),
  ('silly-animal-names', 3, 'Dik-dik', '["dik dik"]', 0, NULL),
  ('silly-animal-names', 4, 'Sea pig', NULL, 0, NULL),
  ('silly-animal-names', 5, 'Wobbegong', NULL, 0, NULL),
  ('silly-animal-names', 6, 'Pink fairy armadillo', NULL, 0, NULL),
  ('silly-animal-names', 7, 'Sarcastic fringehead', NULL, 0, NULL),
  ('silly-animal-names', 8, 'Tufted titmouse', '["titmouse"]', 0, NULL),
  ('silly-animal-names', 9, 'Booby', '["blue footed booby"]', 0, NULL),
  ('silly-animal-names', 10, 'Bongo', NULL, 0, NULL),
  ('silly-animal-names', 11, 'Quokka', NULL, 0, NULL),
  ('silly-animal-names', 12, 'Numbat', NULL, 0, NULL),
  ('silly-animal-names', 13, 'Potoo', NULL, 0, NULL),
  ('silly-animal-names', 14, 'Shoebill', NULL, 0, NULL),
  ('silly-animal-names', 15, 'Boops boops', NULL, 0, NULL);

-- ── Name 10 silly-sounding English words
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('silly-english-words', 'words', 'Name 10 silly-sounding English words', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('silly-english-words', 1, 'Kerfuffle', NULL, 0, NULL),
  ('silly-english-words', 2, 'Gobbledygook', '["gobbledegook"]', 0, NULL),
  ('silly-english-words', 3, 'Flibbertigibbet', NULL, 0, NULL),
  ('silly-english-words', 4, 'Codswallop', NULL, 0, NULL),
  ('silly-english-words', 5, 'Hullabaloo', NULL, 0, NULL),
  ('silly-english-words', 6, 'Skedaddle', NULL, 0, NULL),
  ('silly-english-words', 7, 'Bamboozle', NULL, 0, NULL),
  ('silly-english-words', 8, 'Discombobulate', '["discombobulated"]', 0, NULL),
  ('silly-english-words', 9, 'Nincompoop', NULL, 0, NULL),
  ('silly-english-words', 10, 'Shenanigans', NULL, 0, NULL),
  ('silly-english-words', 11, 'Poppycock', NULL, 0, NULL),
  ('silly-english-words', 12, 'Lollygag', NULL, 0, NULL),
  ('silly-english-words', 13, 'Gubbins', NULL, 0, NULL),
  ('silly-english-words', 14, 'Wonky', NULL, 0, NULL),
  ('silly-english-words', 15, 'Collywobbles', NULL, 0, NULL);

-- ── Name 10 bits of British slang for being drunk
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('drunk-slang', 'words', 'Name 10 bits of British slang for being drunk', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('drunk-slang', 1, 'Hammered', NULL, 0, NULL),
  ('drunk-slang', 2, 'Smashed', NULL, 0, NULL),
  ('drunk-slang', 3, 'Wasted', NULL, 0, NULL),
  ('drunk-slang', 4, 'Legless', NULL, 0, NULL),
  ('drunk-slang', 5, 'Plastered', NULL, 0, NULL),
  ('drunk-slang', 6, 'Trollied', '["trolleyed"]', 0, NULL),
  ('drunk-slang', 7, 'Steaming', NULL, 0, NULL),
  ('drunk-slang', 8, 'Sloshed', NULL, 0, NULL),
  ('drunk-slang', 9, 'Tipsy', NULL, 0, NULL),
  ('drunk-slang', 10, 'Merry', NULL, 0, NULL),
  ('drunk-slang', 11, 'Battered', NULL, 0, NULL),
  ('drunk-slang', 12, 'Wrecked', NULL, 0, NULL),
  ('drunk-slang', 13, 'Blotto', NULL, 0, NULL),
  ('drunk-slang', 14, 'Sozzled', NULL, 0, NULL),
  ('drunk-slang', 15, 'Bladdered', NULL, 0, NULL),
  ('drunk-slang', 16, 'Paralytic', NULL, 0, NULL);

-- ── Name 10 famous fictional pigs
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('fictional-pigs', 'film', 'Name 10 famous fictional pigs', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('fictional-pigs', 1, 'Peppa Pig', '["peppa"]', 0, NULL),
  ('fictional-pigs', 2, 'Babe', NULL, 0, NULL),
  ('fictional-pigs', 3, 'Miss Piggy', NULL, 0, NULL),
  ('fictional-pigs', 4, 'Wilbur', NULL, 0, NULL),
  ('fictional-pigs', 5, 'Piglet', NULL, 0, NULL),
  ('fictional-pigs', 6, 'Napoleon', NULL, 0, NULL),
  ('fictional-pigs', 7, 'Snowball', NULL, 0, NULL),
  ('fictional-pigs', 8, 'Old Major', NULL, 0, NULL),
  ('fictional-pigs', 9, 'Hamm', NULL, 0, NULL),
  ('fictional-pigs', 10, 'Porky Pig', '["porky"]', 0, NULL),
  ('fictional-pigs', 11, 'Spider-Pig', '["spider pig"]', 0, NULL),
  ('fictional-pigs', 12, 'Percy Pig', '["percy"]', 0, NULL),
  ('fictional-pigs', 13, 'Pigling Bland', NULL, 0, NULL),
  ('fictional-pigs', 14, 'Gub-Gub', '["gub gub"]', 0, NULL);

-- ── Name 10 bingo calls
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('bingo-calls', 'games', 'Name 10 bingo calls', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('bingo-calls', 1, 'Kelly''s Eye', '["kellys eye"]', 0, NULL),
  ('bingo-calls', 2, 'Legs Eleven', NULL, 0, NULL),
  ('bingo-calls', 3, 'Unlucky for Some', NULL, 0, NULL),
  ('bingo-calls', 4, 'Key of the Door', NULL, 0, NULL),
  ('bingo-calls', 5, 'Two Little Ducks', NULL, 0, NULL),
  ('bingo-calls', 6, 'Dirty Gertie', NULL, 0, NULL),
  ('bingo-calls', 7, 'Danny La Rue', NULL, 0, NULL),
  ('bingo-calls', 8, 'Clickety Click', NULL, 0, NULL),
  ('bingo-calls', 9, 'Was She Worth It?', '["was she worth it"]', 0, NULL),
  ('bingo-calls', 10, 'Two Fat Ladies', NULL, 0, NULL),
  ('bingo-calls', 11, 'Top of the Shop', NULL, 0, NULL),
  ('bingo-calls', 12, 'Doctor''s Orders', '["doctors orders"]', 0, NULL),
  ('bingo-calls', 13, 'Garden Gate', NULL, 0, NULL);

-- ── Name 10 famous last words before something goes wrong
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('famous-last-words', 'life', 'Name 10 famous last words before something goes wrong', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('famous-last-words', 1, 'Hold my drink', '["hold my beer"]', 0, NULL),
  ('famous-last-words', 2, 'Watch this', NULL, 0, NULL),
  ('famous-last-words', 3, 'Trust me', NULL, 0, NULL),
  ('famous-last-words', 4, 'How hard can it be?', '["how hard can it be"]', 0, NULL),
  ('famous-last-words', 5, 'What''s the worst that could happen?', '["whats the worst that could happen","whats the worst that can happen"]', 0, NULL),
  ('famous-last-words', 6, 'It''ll be fine', '["itll be fine","it will be fine"]', 0, NULL),
  ('famous-last-words', 7, 'I''ve done this loads', '["ive done this loads","ive done this before"]', 0, NULL),
  ('famous-last-words', 8, 'No need for the instructions', '["no need for instructions","we dont need the instructions"]', 0, NULL),
  ('famous-last-words', 9, 'Is this thing on?', '["is this thing on"]', 0, NULL),
  ('famous-last-words', 10, 'Don''t worry, I know a shortcut', '["i know a shortcut","shortcut"]', 0, NULL),
  ('famous-last-words', 11, 'Stand back', '["everyone stand back"]', 0, NULL),
  ('famous-last-words', 12, 'It''s probably nothing', '["its probably nothing"]', 0, NULL),
  ('famous-last-words', 13, 'I''ve seen this done on YouTube', '["ive seen this on youtube","i watched a video"]', 0, NULL),
  ('famous-last-words', 14, 'What does this button do?', '["what does this button do","whats this button"]', 0, NULL);

-- ── Name 10 things in your nan's handbag
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('nans-handbag', 'life', 'Name 10 things in your nan''s handbag', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('nans-handbag', 1, 'Tissues', '["a tissue","kleenex"]', 0, NULL),
  ('nans-handbag', 2, 'Werther''s Originals', '["werthers","werthers originals"]', 0, NULL),
  ('nans-handbag', 3, 'Mints', '["polos","a mint"]', 0, NULL),
  ('nans-handbag', 4, 'Reading glasses', '["glasses","specs"]', 0, NULL),
  ('nans-handbag', 5, 'A hanky', '["hanky","handkerchief"]', 0, NULL),
  ('nans-handbag', 6, 'Lipstick', NULL, 0, NULL),
  ('nans-handbag', 7, 'Her purse', '["purse"]', 0, NULL),
  ('nans-handbag', 8, 'Plasters', '["a plaster"]', 0, NULL),
  ('nans-handbag', 9, 'Hand cream', '["handcream","moisturiser"]', 0, NULL),
  ('nans-handbag', 10, 'A comb', '["comb","hairbrush"]', 0, NULL),
  ('nans-handbag', 11, 'Bus pass', '["her bus pass"]', 0, NULL),
  ('nans-handbag', 12, 'An umbrella', '["umbrella","brolly"]', 0, NULL),
  ('nans-handbag', 13, 'Old receipts', '["receipts","a receipt"]', 0, NULL),
  ('nans-handbag', 14, 'A biro', '["biro","a pen","pen"]', 0, NULL);

-- ── Name 10 rubbish superpowers
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('rubbish-superpowers', 'life', 'Name 10 rubbish superpowers', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('rubbish-superpowers', 1, 'Always finding the TV remote', '["finding the remote","always finding the remote"]', 0, NULL),
  ('rubbish-superpowers', 2, 'Making toast perfectly', '["perfect toast","making perfect toast"]', 0, NULL),
  ('rubbish-superpowers', 3, 'Never stubbing your toe', '["never stubbing a toe"]', 0, NULL),
  ('rubbish-superpowers', 4, 'Knowing the time exactly', '["always knowing the time","knowing the time"]', 0, NULL),
  ('rubbish-superpowers', 5, 'Always getting a trolley with good wheels', '["a trolley with good wheels","good trolley wheels"]', 0, NULL),
  ('rubbish-superpowers', 6, 'Untangling headphones', '["untangling wires","untangling earphones"]', 0, NULL),
  ('rubbish-superpowers', 7, 'Never getting brain freeze', '["no brain freeze"]', 0, NULL),
  ('rubbish-superpowers', 8, 'Always finding a parking space', '["finding a parking space","parking space"]', 0, NULL),
  ('rubbish-superpowers', 9, 'Talking to pigeons', '["talking to a pigeon","pigeon telepathy"]', 0, NULL),
  ('rubbish-superpowers', 10, 'Always knowing when the kettle has boiled', '["knowing when the kettle has boiled","kettle sense"]', 0, NULL),
  ('rubbish-superpowers', 11, 'Opening any jar', '["opening jars","always opening jars"]', 0, NULL),
  ('rubbish-superpowers', 12, 'Never losing a sock', '["never losing socks"]', 0, NULL),
  ('rubbish-superpowers', 13, 'Always picking the fastest queue', '["picking the fastest queue","the right queue"]', 0, NULL),
  ('rubbish-superpowers', 14, 'Folding a fitted sheet', '["folding fitted sheets"]', 0, NULL);

-- ── Name 10 things people do in the shower
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('things-in-the-shower', 'life', 'Name 10 things people do in the shower', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('things-in-the-shower', 1, 'Sing', '["singing"]', 0, NULL),
  ('things-in-the-shower', 2, 'Think', '["thinking","overthink"]', 0, NULL),
  ('things-in-the-shower', 3, 'Cry', '["crying"]', 0, NULL),
  ('things-in-the-shower', 4, 'Rehearse arguments', '["argue with someone who isnt there","rehearse an argument"]', 0, NULL),
  ('things-in-the-shower', 5, 'Shave', '["shaving"]', 0, NULL),
  ('things-in-the-shower', 6, 'Plan their day', '["plan the day","planning"]', 0, NULL),
  ('things-in-the-shower', 7, 'Have great ideas', '["have a good idea","best ideas"]', 0, NULL),
  ('things-in-the-shower', 8, 'Wash their hair', '["shampoo","washing their hair"]', 0, NULL),
  ('things-in-the-shower', 9, 'Brush their teeth', '["brushing teeth"]', 0, NULL),
  ('things-in-the-shower', 10, 'Do a concert', '["perform a concert","use the shampoo as a microphone"]', 0, NULL),
  ('things-in-the-shower', 11, 'Use all the hot water', '["all the hot water","use up the hot water"]', 0, NULL),
  ('things-in-the-shower', 12, 'Lose track of time', '["stay in too long","lose all track of time"]', 0, NULL);

-- ── Name 10 things people pretend to understand
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('pretend-to-understand', 'life', 'Name 10 things people pretend to understand', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('pretend-to-understand', 1, 'Crypto', '["bitcoin","cryptocurrency"]', 0, NULL),
  ('pretend-to-understand', 2, 'Wine tasting', '["wine"]', 0, NULL),
  ('pretend-to-understand', 3, 'The offside rule', '["offside","offside rule"]', 0, NULL),
  ('pretend-to-understand', 4, 'Tax returns', '["tax","self assessment","taxes"]', 0, NULL),
  ('pretend-to-understand', 5, 'Modern art', '["art"]', 0, NULL),
  ('pretend-to-understand', 6, 'Jazz', NULL, 0, NULL),
  ('pretend-to-understand', 7, 'Cricket', NULL, 0, NULL),
  ('pretend-to-understand', 8, 'Mortgages', '["a mortgage"]', 0, NULL),
  ('pretend-to-understand', 9, 'NFTs', '["nft"]', 0, NULL),
  ('pretend-to-understand', 10, 'Quantum physics', '["quantum"]', 0, NULL),
  ('pretend-to-understand', 11, 'The stock market', '["stocks","shares","the markets"]', 0, NULL),
  ('pretend-to-understand', 12, 'IKEA instructions', '["ikea","flatpack instructions"]', 0, NULL),
  ('pretend-to-understand', 13, 'The plot of Inception', '["inception"]', 0, NULL);

-- ── Name 10 things that smell awful
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('awful-smells', 'life', 'Name 10 things that smell awful', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('awful-smells', 1, 'Wet dog', '["a wet dog"]', 0, NULL),
  ('awful-smells', 2, 'Feet', '["smelly feet","cheesy feet"]', 0, NULL),
  ('awful-smells', 3, 'A gym bag', '["gym bag","gym kit"]', 0, NULL),
  ('awful-smells', 4, 'Bins', '["the bin","rubbish","bin juice"]', 0, NULL),
  ('awful-smells', 5, 'Rotten eggs', '["egg","bad eggs"]', 0, NULL),
  ('awful-smells', 6, 'Durian', NULL, 0, NULL),
  ('awful-smells', 7, 'Cooked sprouts', '["sprouts","brussel sprouts","brussels sprouts"]', 0, NULL),
  ('awful-smells', 8, 'Blue cheese', '["stilton"]', 0, NULL),
  ('awful-smells', 9, 'Nappies', '["a nappy","dirty nappies"]', 0, NULL),
  ('awful-smells', 10, 'A fish market', '["fish","fishmongers"]', 0, NULL),
  ('awful-smells', 11, 'A teenager''s bedroom', '["a teenagers bedroom","teenage bedroom"]', 0, NULL),
  ('awful-smells', 12, 'Burnt toast', NULL, 0, NULL),
  ('awful-smells', 13, 'Cabbage', '["boiled cabbage"]', 0, NULL);

-- ── Name 10 things you hear at a family Christmas
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('family-christmas', 'life', 'Name 10 things you hear at a family Christmas', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('family-christmas', 1, 'Who wants a sherry?', '["who wants a sherry","sherry anyone"]', 0, NULL),
  ('family-christmas', 2, 'Mind the cracker', '["mind the crackers"]', 0, NULL),
  ('family-christmas', 3, 'Pass the sprouts', '["pass the sprouts please"]', 0, NULL),
  ('family-christmas', 4, 'Put the King on', '["turn the king on","the kings speech","the queens speech"]', 0, NULL),
  ('family-christmas', 5, 'I''m stuffed', '["im stuffed","im full"]', 0, NULL),
  ('family-christmas', 6, 'Is it Monopoly time?', '["is it monopoly time","shall we play monopoly"]', 0, NULL),
  ('family-christmas', 7, 'Watch the oven', '["check the oven"]', 0, NULL),
  ('family-christmas', 8, 'Who''s driving?', '["whos driving"]', 0, NULL),
  ('family-christmas', 9, 'Where are the batteries?', '["where are the batteries","has anyone got any batteries"]', 0, NULL),
  ('family-christmas', 10, 'Not another pair of socks', '["not more socks","socks again"]', 0, NULL),
  ('family-christmas', 11, 'Who''s got the remote?', '["whos got the remote","where is the remote"]', 0, NULL),
  ('family-christmas', 12, 'There''s a draught', '["theres a draught","can you feel a draught"]', 0, NULL),
  ('family-christmas', 13, 'Shall we do presents?', '["shall we do presents","presents time"]', 0, NULL),
  ('family-christmas', 14, 'I''m never eating again', '["im never eating again"]', 0, NULL);

-- ── Name 10 ways to avoid washing up
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('avoid-washing-up', 'life', 'Name 10 ways to avoid washing up', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('avoid-washing-up', 1, 'It''s soaking', '["its soaking","leave it to soak","let it soak"]', 0, NULL),
  ('avoid-washing-up', 2, 'I cooked', '["but i cooked"]', 0, NULL),
  ('avoid-washing-up', 3, 'The dishwasher''s full', '["dishwashers full","the dishwasher is full"]', 0, NULL),
  ('avoid-washing-up', 4, 'I''ll do it in the morning', '["ill do it in the morning","ill do it later"]', 0, NULL),
  ('avoid-washing-up', 5, 'Eat off the packaging', '["eat out of the packet","straight from the tub"]', 0, NULL),
  ('avoid-washing-up', 6, 'Use paper plates', '["paper plates"]', 0, NULL),
  ('avoid-washing-up', 7, 'Order a takeaway', '["takeaway","get a takeaway"]', 0, NULL),
  ('avoid-washing-up', 8, 'Hide in the loo', '["go to the toilet","hide in the toilet"]', 0, NULL),
  ('avoid-washing-up', 9, 'Pretend to be on a call', '["pretend youre on the phone","take a fake call"]', 0, NULL),
  ('avoid-washing-up', 10, 'I don''t know where things go', '["i dont know where anything goes","i dont know where it all goes"]', 0, NULL),
  ('avoid-washing-up', 11, 'Suddenly remember something urgent', '["remember an urgent job","i have to do something"]', 0, NULL),
  ('avoid-washing-up', 12, 'Put it in to soak and forget it', '["leave it till tomorrow","forget about it"]', 0, NULL);

-- ── Name 10 things that are surprisingly loud
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('surprisingly-loud', 'life', 'Name 10 things that are surprisingly loud', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('surprisingly-loud', 1, 'A crisp packet in the cinema', '["crisp packet","a crisp packet"]', 0, NULL),
  ('surprisingly-loud', 2, 'A stomach rumbling in an exam', '["stomach rumbling","a rumbling stomach"]', 0, NULL),
  ('surprisingly-loud', 3, 'A pen click in a quiet office', '["clicking a pen","a pen click","pen clicking"]', 0, NULL),
  ('surprisingly-loud', 4, 'A sweet wrapper', '["sweet wrapper","a wrapper"]', 0, NULL),
  ('surprisingly-loud', 5, 'A sneeze in a library', '["sneezing in a library","a sneeze"]', 0, NULL),
  ('surprisingly-loud', 6, 'A toilet flush at night', '["flushing at night","the toilet at 2am"]', 0, NULL),
  ('surprisingly-loud', 7, 'A fridge hum at 3am', '["the fridge","a humming fridge"]', 0, NULL),
  ('surprisingly-loud', 8, 'An alarm on a Saturday', '["an alarm going off on a saturday","your alarm at the weekend"]', 0, NULL),
  ('surprisingly-loud', 9, 'A creaky floorboard', '["creaky floorboards","a floorboard"]', 0, NULL),
  ('surprisingly-loud', 10, 'A zip in a silent room', '["a zip","zipping a coat"]', 0, NULL),
  ('surprisingly-loud', 11, 'Velcro', '["a velcro strap"]', 0, NULL),
  ('surprisingly-loud', 12, 'A bag of ice going in the freezer', '["ice cubes","the ice maker"]', 0, NULL);

-- ── Name 10 rubbish Christmas presents
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('rubbish-christmas-presents', 'life', 'Name 10 rubbish Christmas presents', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('rubbish-christmas-presents', 1, 'Socks', '["a pair of socks"]', 0, NULL),
  ('rubbish-christmas-presents', 2, 'A novelty mug', '["novelty mug","a mug"]', 0, NULL),
  ('rubbish-christmas-presents', 3, 'A bath set', '["bath set","bubble bath"]', 0, NULL),
  ('rubbish-christmas-presents', 4, 'A calendar', '["calendar"]', 0, NULL),
  ('rubbish-christmas-presents', 5, 'A keyring', '["keyring","key ring"]', 0, NULL),
  ('rubbish-christmas-presents', 6, 'A gift card for a shop you hate', '["gift card","a voucher","voucher"]', 0, NULL),
  ('rubbish-christmas-presents', 7, 'A satsuma', '["satsuma","an orange"]', 0, NULL),
  ('rubbish-christmas-presents', 8, 'A scented candle', '["scented candle","a candle"]', 0, NULL),
  ('rubbish-christmas-presents', 9, 'A toiletries set', '["toiletries","smellies"]', 0, NULL),
  ('rubbish-christmas-presents', 10, 'A book you already have', '["a book youve already read","a book you own"]', 0, NULL),
  ('rubbish-christmas-presents', 11, 'A ''World''s Best Dad'' mug', '["worlds best dad mug","best dad mug"]', 0, NULL),
  ('rubbish-christmas-presents', 12, 'Regifted wine', '["regifted wine","wine someone gave them"]', 0, NULL),
  ('rubbish-christmas-presents', 13, 'A selection box with the good ones gone', '["selection box"]', 0, NULL);

-- ── Name 10 signs you're getting old
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('signs-getting-old', 'life', 'Name 10 signs you''re getting old', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('signs-getting-old', 1, 'Groaning when you sit down', '["groaning when you stand up","making a noise when you sit down"]', 0, NULL),
  ('signs-getting-old', 2, 'Early nights', '["an early night","going to bed early"]', 0, NULL),
  ('signs-getting-old', 3, '"In my day…"', '["in my day"]', 0, NULL),
  ('signs-getting-old', 4, 'Loving a garden centre', '["garden centres","a trip to the garden centre"]', 0, NULL),
  ('signs-getting-old', 5, 'Checking the weather daily', '["checking the forecast","watching the weather"]', 0, NULL),
  ('signs-getting-old', 6, 'Not knowing the charts', '["not knowing any music","never heard of any of them"]', 0, NULL),
  ('signs-getting-old', 7, 'Enjoying a good hoover', '["enjoying hoovering","a good hoover"]', 0, NULL),
  ('signs-getting-old', 8, 'Bringing a cardigan', '["taking a cardigan","bringing a jumper"]', 0, NULL),
  ('signs-getting-old', 9, 'Comparing car parks', '["talking about parking","discussing the car park"]', 0, NULL),
  ('signs-getting-old', 10, 'Being excited by a new kettle', '["excited about a kettle","a new kettle"]', 0, NULL),
  ('signs-getting-old', 11, 'Falling asleep in front of the telly', '["falling asleep watching tv","nodding off in the chair"]', 0, NULL),
  ('signs-getting-old', 12, 'Reading the instructions first', '["actually reading the manual"]', 0, NULL);

-- ── Name 10 things Brits say sorry to
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('brits-say-sorry-to', 'life', 'Name 10 things Brits say sorry to', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('brits-say-sorry-to', 1, 'A door', '["a door frame","walking into a door"]', 0, NULL),
  ('brits-say-sorry-to', 2, 'A chair', '["a table","furniture"]', 0, NULL),
  ('brits-say-sorry-to', 3, 'A lamppost', '["a lamp post"]', 0, NULL),
  ('brits-say-sorry-to', 4, 'The person who bumped into them', '["someone who bumped into them","the person who barged them"]', 0, NULL),
  ('brits-say-sorry-to', 5, 'A dog', '["someones dog"]', 0, NULL),
  ('brits-say-sorry-to', 6, 'The bus driver', '["a bus driver"]', 0, NULL),
  ('brits-say-sorry-to', 7, 'A shop dummy', '["a mannequin","mannequin"]', 0, NULL),
  ('brits-say-sorry-to', 8, 'Someone blocking the aisle', '["a person in the way","someone in their way"]', 0, NULL),
  ('brits-say-sorry-to', 9, 'A cashier', '["the checkout person"]', 0, NULL),
  ('brits-say-sorry-to', 10, 'A self-checkout', '["the self checkout","a machine"]', 0, NULL),
  ('brits-say-sorry-to', 11, 'A pigeon', '["a bird"]', 0, NULL),
  ('brits-say-sorry-to', 12, 'An inanimate object', '["literally anything","a wall"]', 0, NULL);

-- ── Name 10 things Brits love to talk about
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('brits-talk-about', 'life', 'Name 10 things Brits love to talk about', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('brits-talk-about', 1, 'The weather', '["weather"]', 0, NULL),
  ('brits-talk-about', 2, 'Queues', '["queueing","the queue"]', 0, NULL),
  ('brits-talk-about', 3, 'Tea', '["a cup of tea"]', 0, NULL),
  ('brits-talk-about', 4, 'Traffic', '["the traffic"]', 0, NULL),
  ('brits-talk-about', 5, 'The M25', '["m25","the motorway"]', 0, NULL),
  ('brits-talk-about', 6, 'House prices', '["the housing market","property prices"]', 0, NULL),
  ('brits-talk-about', 7, 'The NHS', '["nhs","waiting lists"]', 0, NULL),
  ('brits-talk-about', 8, 'The trains', '["trains","the railways"]', 0, NULL),
  ('brits-talk-about', 9, 'Bake Off', '["the bake off","great british bake off"]', 0, NULL),
  ('brits-talk-about', 10, 'Holiday plans', '["their holiday","where theyre going on holiday"]', 0, NULL),
  ('brits-talk-about', 11, 'Roadworks', '["road works"]', 0, NULL),
  ('brits-talk-about', 12, 'The price of a pint', '["how much a pint costs","pint prices"]', 0, NULL);

-- ── Name 10 things you'd find at a car boot sale
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('car-boot-sale', 'life', 'Name 10 things you''d find at a car boot sale', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('car-boot-sale', 1, 'DVDs', '["a dvd","dvd"]', 0, NULL),
  ('car-boot-sale', 2, 'Old toys', '["toys","a box of toys"]', 0, NULL),
  ('car-boot-sale', 3, 'Kids'' clothes', '["kids clothes","childrens clothes"]', 0, NULL),
  ('car-boot-sale', 4, 'Books', '["a book","paperbacks"]', 0, NULL),
  ('car-boot-sale', 5, 'VHS tapes', '["vhs","videos"]', 0, NULL),
  ('car-boot-sale', 6, 'Ornaments', '["an ornament","knick knacks"]', 0, NULL),
  ('car-boot-sale', 7, 'Power tools', '["tools","a drill"]', 0, NULL),
  ('car-boot-sale', 8, 'Mugs', '["a mug","cups"]', 0, NULL),
  ('car-boot-sale', 9, 'Prams', '["a pram","a buggy"]', 0, NULL),
  ('car-boot-sale', 10, 'Jigsaws', '["a jigsaw","puzzles"]', 0, NULL),
  ('car-boot-sale', 11, 'Vinyl records', '["records","vinyl","lps"]', 0, NULL),
  ('car-boot-sale', 12, 'A broken lamp', '["lamps","a lamp"]', 0, NULL),
  ('car-boot-sale', 13, 'A bread maker', '["breadmaker","a bread machine"]', 0, NULL);

-- ── Name 10 things you shout at the TV during a football match
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('shout-at-the-football', 'sport', 'Name 10 things you shout at the TV during a football match', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('shout-at-the-football', 1, 'Offside!', '["offside"]', 0, NULL),
  ('shout-at-the-football', 2, 'Shoot!', '["shoot","have a shot"]', 0, NULL),
  ('shout-at-the-football', 3, 'Penalty!', '["penalty","thats a pen","pen"]', 0, NULL),
  ('shout-at-the-football', 4, 'Get up!', '["get up","hes fine"]', 0, NULL),
  ('shout-at-the-football', 5, 'Ref!', '["ref","referee"]', 0, NULL),
  ('shout-at-the-football', 6, 'Man on!', '["man on"]', 0, NULL),
  ('shout-at-the-football', 7, 'Pass it!', '["pass it","pass"]', 0, NULL),
  ('shout-at-the-football', 8, 'Get rid!', '["get rid","hoof it"]', 0, NULL),
  ('shout-at-the-football', 9, 'Unbelievable!', '["unbelievable"]', 0, NULL),
  ('shout-at-the-football', 10, 'What was that?', '["what was that"]', 0, NULL),
  ('shout-at-the-football', 11, 'He dived!', '["he dived","thats a dive","dive"]', 0, NULL),
  ('shout-at-the-football', 12, 'VAR!', '["var","check it"]', 0, NULL);

-- ── Name 10 things that wobble
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('things-that-wobble', 'life', 'Name 10 things that wobble', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('things-that-wobble', 1, 'Jelly', '["jello"]', 0, NULL),
  ('things-that-wobble', 2, 'A table leg', '["a wobbly table","a table"]', 0, NULL),
  ('things-that-wobble', 3, 'A tooth', '["a loose tooth","a wobbly tooth"]', 0, NULL),
  ('things-that-wobble', 4, 'A trampoline', '["trampoline"]', 0, NULL),
  ('things-that-wobble', 5, 'A bike with stabilisers', '["stabilisers","a learner bike"]', 0, NULL),
  ('things-that-wobble', 6, 'A belly', '["a tummy","your belly"]', 0, NULL),
  ('things-that-wobble', 7, 'A Weeble', '["weebles","weeble"]', 0, NULL),
  ('things-that-wobble', 8, 'A bridge', '["a rope bridge","a wobbly bridge"]', 0, NULL),
  ('things-that-wobble', 9, 'A blancmange', '["blancmange"]', 0, NULL),
  ('things-that-wobble', 10, 'A ladder', '["a wobbly ladder"]', 0, NULL),
  ('things-that-wobble', 11, 'A waterbed', '["water bed"]', 0, NULL),
  ('things-that-wobble', 12, 'A newborn deer', '["a baby deer","a fawn","bambi"]', 0, NULL);

-- ── Name 10 words that contain "bum"
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('words-containing-bum', 'words', 'Name 10 words that contain "bum"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('words-containing-bum', 1, 'Album', NULL, 0, NULL),
  ('words-containing-bum', 2, 'Bumble', NULL, 0, NULL),
  ('words-containing-bum', 3, 'Bumblebee', '["bumble bee"]', 0, NULL),
  ('words-containing-bum', 4, 'Bump', NULL, 0, NULL),
  ('words-containing-bum', 5, 'Bumpy', NULL, 0, NULL),
  ('words-containing-bum', 6, 'Bumper', NULL, 0, NULL),
  ('words-containing-bum', 7, 'Bumpkin', NULL, 0, NULL),
  ('words-containing-bum', 8, 'Bumbag', '["bum bag"]', 0, NULL),
  ('words-containing-bum', 9, 'Bumf', NULL, 0, NULL),
  ('words-containing-bum', 10, 'Bumbling', NULL, 0, NULL),
  ('words-containing-bum', 11, 'Bumptious', NULL, 0, NULL),
  ('words-containing-bum', 12, 'Bumblebees', NULL, 0, NULL),
  ('words-containing-bum', 13, 'Bumped', NULL, 0, NULL);

-- ── Name 10 things a dog will eat that it shouldn't
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('dog-eats-wrong', 'nature', 'Name 10 things a dog will eat that it shouldn''t', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('dog-eats-wrong', 1, 'Socks', '["a sock"]', 0, NULL),
  ('dog-eats-wrong', 2, 'The remote control', '["the remote","remote"]', 0, NULL),
  ('dog-eats-wrong', 3, 'Tissues', '["a tissue","kleenex"]', 0, NULL),
  ('dog-eats-wrong', 4, 'Shoes', '["a shoe","trainers","slippers"]', 0, NULL),
  ('dog-eats-wrong', 5, 'Cushions', '["a cushion","the sofa"]', 0, NULL),
  ('dog-eats-wrong', 6, 'Lego', '["a lego brick"]', 0, NULL),
  ('dog-eats-wrong', 7, 'Sticks', '["a stick"]', 0, NULL),
  ('dog-eats-wrong', 8, 'Toilet roll', '["loo roll","the toilet paper"]', 0, NULL),
  ('dog-eats-wrong', 9, 'Tennis balls', '["a tennis ball"]', 0, NULL),
  ('dog-eats-wrong', 10, 'A birthday cake', '["the cake","cake"]', 0, NULL),
  ('dog-eats-wrong', 11, 'The post', '["the letters","the mail"]', 0, NULL),
  ('dog-eats-wrong', 12, 'Homework', '["your homework"]', 0, NULL);

-- ── Name 10 things you see on a hen do
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('hen-do', 'life', 'Name 10 things you see on a hen do', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('hen-do', 1, 'Sashes', '["a sash"]', 0, NULL),
  ('hen-do', 2, 'L-plates', '["l plates","an l plate"]', 0, NULL),
  ('hen-do', 3, 'Tiaras', '["a tiara"]', 0, NULL),
  ('hen-do', 4, 'Pink feathers', '["feather boas","a feather boa","feathers"]', 0, NULL),
  ('hen-do', 5, 'Inflatable flamingos', '["an inflatable flamingo","flamingos"]', 0, NULL),
  ('hen-do', 6, 'Matching T-shirts', '["matching t shirts","matching tops"]', 0, NULL),
  ('hen-do', 7, 'Cocktails', '["a cocktail","prosecco in a jug"]', 0, NULL),
  ('hen-do', 8, 'A limo', '["limo","a party bus"]', 0, NULL),
  ('hen-do', 9, 'A bride in a veil', '["a veil","the bride in a veil"]', 0, NULL),
  ('hen-do', 10, 'Prosecco', '["fizz","bubbly"]', 0, NULL),
  ('hen-do', 11, 'A dance class', '["a dance lesson","a class"]', 0, NULL),
  ('hen-do', 12, 'A lost handbag', '["someones lost bag","a lost bag"]', 0, NULL),
  ('hen-do', 13, 'A photo in a hot tub', '["a hot tub","spa day"]', 0, NULL);

-- ── Name 10 things you see on a stag do
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('stag-do', 'life', 'Name 10 things you see on a stag do', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('stag-do', 1, 'Fancy dress', '["costumes","everyone in fancy dress"]', 0, NULL),
  ('stag-do', 2, 'A costume for the groom', '["the groom in a costume","the groom dressed up","the groom in a mankini"]', 0, NULL),
  ('stag-do', 3, 'Paintball', '["paintballing"]', 0, NULL),
  ('stag-do', 4, 'A pub crawl', '["pub crawl","a bar crawl"]', 0, NULL),
  ('stag-do', 5, 'Go-karting', '["go karting","karting"]', 0, NULL),
  ('stag-do', 6, 'Matching T-shirts', '["matching t shirts","matching tops"]', 0, NULL),
  ('stag-do', 7, 'A lost shoe', '["someones lost shoe","one shoe"]', 0, NULL),
  ('stag-do', 8, 'A strip of photos', '["photo booth","a photo booth strip"]', 0, NULL),
  ('stag-do', 9, 'A hangover', '["hangovers","a terrible hangover"]', 0, NULL),
  ('stag-do', 10, 'A missed flight', '["missing the flight","a missed train"]', 0, NULL),
  ('stag-do', 11, 'Someone asleep in the wrong room', '["someone asleep somewhere odd"]', 0, NULL),
  ('stag-do', 12, 'A forfeit', '["forfeits","a dare"]', 0, NULL);

-- ── Name 10 annoying things people do on public transport
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('public-transport-annoyances', 'transport', 'Name 10 annoying things people do on public transport', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('public-transport-annoyances', 1, 'Loud phone calls', '["talking loudly on the phone","a loud phone call"]', 0, NULL),
  ('public-transport-annoyances', 2, 'Eating egg sandwiches', '["egg sandwiches","eating eggs"]', 0, NULL),
  ('public-transport-annoyances', 3, 'Taking up two seats', '["putting a bag on the seat","a bag on the seat","two seats"]', 0, NULL),
  ('public-transport-annoyances', 4, 'Music without headphones', '["playing music out loud","tinny music","music on speaker"]', 0, NULL),
  ('public-transport-annoyances', 5, 'Manspreading', '["sitting with their legs wide open"]', 0, NULL),
  ('public-transport-annoyances', 6, 'Blocking the doors', '["standing in the doorway","blocking the doorway"]', 0, NULL),
  ('public-transport-annoyances', 7, 'Cutting their nails', '["clipping their nails","nail clipping"]', 0, NULL),
  ('public-transport-annoyances', 8, 'Smelly food', '["eating smelly food","hot food"]', 0, NULL),
  ('public-transport-annoyances', 9, 'Standing too close', '["invading your space","standing right next to you"]', 0, NULL),
  ('public-transport-annoyances', 10, 'Video calls on speaker', '["facetiming","a video call out loud"]', 0, NULL),
  ('public-transport-annoyances', 11, 'Not letting people off first', '["pushing on before people get off","barging on"]', 0, NULL),
  ('public-transport-annoyances', 12, 'Putting their feet on the seat', '["feet on the seats","shoes on the seat"]', 0, NULL);

-- ── Name 10 things you hear in a primary school playground
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('primary-school-playground', 'life', 'Name 10 things you hear in a primary school playground', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('primary-school-playground', 1, 'It''s not fair!', '["its not fair"]', 0, NULL),
  ('primary-school-playground', 2, 'You''re it!', '["youre it","tag youre it"]', 0, NULL),
  ('primary-school-playground', 3, 'Miss!', '["miss","sir"]', 0, NULL),
  ('primary-school-playground', 4, 'I''m telling', '["im telling","im telling on you","im telling miss"]', 0, NULL),
  ('primary-school-playground', 5, 'Jinx!', '["jinx"]', 0, NULL),
  ('primary-school-playground', 6, 'Can I play?', '["can i play","can i join in"]', 0, NULL),
  ('primary-school-playground', 7, 'That''s cheating', '["thats cheating","cheat"]', 0, NULL),
  ('primary-school-playground', 8, 'Bagsy', '["bagsy it","bags it"]', 0, NULL),
  ('primary-school-playground', 9, 'No returns', '["no returns no backs","no backsies"]', 0, NULL),
  ('primary-school-playground', 10, 'You can''t sit with us', '["you cant sit with us","youre not playing"]', 0, NULL),
  ('primary-school-playground', 11, 'I''m on base!', '["im on base","base"]', 0, NULL),
  ('primary-school-playground', 12, 'First!', '["i was first","i bagsied it"]', 0, NULL);

-- ── Name 10 things that make you cry that aren't sad
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('cry-not-sad', 'life', 'Name 10 things that make you cry that aren''t sad', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('cry-not-sad', 1, 'Onions', '["chopping onions","an onion"]', 0, NULL),
  ('cry-not-sad', 2, 'Laughing too hard', '["laughing","laughing so much"]', 0, NULL),
  ('cry-not-sad', 3, 'Yawning', '["a big yawn"]', 0, NULL),
  ('cry-not-sad', 4, 'A sneeze', '["sneezing"]', 0, NULL),
  ('cry-not-sad', 5, 'Wind', '["a cold wind","windy weather"]', 0, NULL),
  ('cry-not-sad', 6, 'Hay fever', '["hayfever","pollen","allergies"]', 0, NULL),
  ('cry-not-sad', 7, 'A wedding speech', '["wedding speeches","a best man speech"]', 0, NULL),
  ('cry-not-sad', 8, 'Cutting chillies', '["chilli","chillies","chilli in your eye"]', 0, NULL),
  ('cry-not-sad', 9, 'The John Lewis Christmas advert', '["john lewis advert","a christmas advert","an advert"]', 0, NULL),
  ('cry-not-sad', 10, 'Stubbing your toe', '["stubbing a toe"]', 0, NULL),
  ('cry-not-sad', 11, 'A puppy video', '["puppy videos","animal videos","a dog video"]', 0, NULL),
  ('cry-not-sad', 12, 'Getting shampoo in your eye', '["shampoo in your eyes","soap in your eye"]', 0, NULL);

-- ── Name 10 reasons to cancel plans
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('reasons-to-cancel', 'life', 'Name 10 reasons to cancel plans', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('reasons-to-cancel', 1, 'I''m tired', '["im tired","im knackered","im shattered"]', 0, NULL),
  ('reasons-to-cancel', 2, 'I''ve got a headache', '["ive got a headache","headache"]', 0, NULL),
  ('reasons-to-cancel', 3, 'Something came up', '["somethings come up"]', 0, NULL),
  ('reasons-to-cancel', 4, 'A family thing', '["family thing","family stuff"]', 0, NULL),
  ('reasons-to-cancel', 5, 'My car''s playing up', '["my cars playing up","the cars broken","car trouble"]', 0, NULL),
  ('reasons-to-cancel', 6, 'I''m skint', '["im skint","no money","im broke"]', 0, NULL),
  ('reasons-to-cancel', 7, 'It''s raining', '["its raining","the weather"]', 0, NULL),
  ('reasons-to-cancel', 8, 'I''ve double booked', '["ive double booked","i double booked"]', 0, NULL),
  ('reasons-to-cancel', 9, 'The dog''s poorly', '["the dogs poorly","the dog is ill","the dogs ill"]', 0, NULL),
  ('reasons-to-cancel', 10, 'I''m waiting for a delivery', '["im waiting in for a delivery","waiting for a parcel"]', 0, NULL),
  ('reasons-to-cancel', 11, 'I think I am coming down with something', '["i feel a bit rough","im coming down with something"]', 0, NULL),
  ('reasons-to-cancel', 12, 'Work is mad at the moment', '["work is mad","ive got too much on"]', 0, NULL);

-- ── Name 10 things a teenager says
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('things-a-teenager-says', 'life', 'Name 10 things a teenager says', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('things-a-teenager-says', 1, 'Whatever', NULL, 0, NULL),
  ('things-a-teenager-says', 2, 'I''m bored', '["im bored"]', 0, NULL),
  ('things-a-teenager-says', 3, 'It''s not fair', '["its not fair"]', 0, NULL),
  ('things-a-teenager-says', 4, 'Can I have a lift?', '["can i have a lift","can you give me a lift"]', 0, NULL),
  ('things-a-teenager-says', 5, 'I''m hungry', '["im hungry"]', 0, NULL),
  ('things-a-teenager-says', 6, 'Five more minutes', '["just five more minutes","in a minute"]', 0, NULL),
  ('things-a-teenager-says', 7, 'You don''t understand', '["you dont understand","you just dont get it"]', 0, NULL),
  ('things-a-teenager-says', 8, 'Everyone else has one', '["everyone else is allowed","all my friends have one"]', 0, NULL),
  ('things-a-teenager-says', 9, 'Can I borrow a tenner?', '["can i borrow a tenner","can i have some money"]', 0, NULL),
  ('things-a-teenager-says', 10, 'I''m not hungry', '["im not hungry"]', 0, NULL),
  ('things-a-teenager-says', 11, 'That''s so cringe', '["thats so cringe","cringe"]', 0, NULL),
  ('things-a-teenager-says', 12, 'Leave me alone', '["get out of my room"]', 0, NULL);

-- ── Name 10 things that ruin a good night's sleep
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('ruin-a-nights-sleep', 'life', 'Name 10 things that ruin a good night''s sleep', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('ruin-a-nights-sleep', 1, 'Snoring', '["a snorer","someone snoring"]', 0, NULL),
  ('ruin-a-nights-sleep', 2, 'A mosquito', '["mosquitos","a buzzing insect","a fly"]', 0, NULL),
  ('ruin-a-nights-sleep', 3, 'A full bladder', '["needing a wee","needing the loo"]', 0, NULL),
  ('ruin-a-nights-sleep', 4, 'A cat on your face', '["the cat","a cat sitting on you"]', 0, NULL),
  ('ruin-a-nights-sleep', 5, 'A car alarm', '["car alarms","an alarm outside"]', 0, NULL),
  ('ruin-a-nights-sleep', 6, 'A crying baby', '["a baby crying","the baby"]', 0, NULL),
  ('ruin-a-nights-sleep', 7, 'A too-hot duvet', '["being too hot","a hot duvet","the wrong tog"]', 0, NULL),
  ('ruin-a-nights-sleep', 8, 'A leaky tap', '["a dripping tap","a tap dripping"]', 0, NULL),
  ('ruin-a-nights-sleep', 9, 'The 3am thoughts', '["overthinking at 3am","thinking about something you said in 2009"]', 0, NULL),
  ('ruin-a-nights-sleep', 10, 'A squeaky bed', '["a creaky bed"]', 0, NULL),
  ('ruin-a-nights-sleep', 11, 'The bin men', '["the bin lorry","bin collection"]', 0, NULL),
  ('ruin-a-nights-sleep', 12, 'A duvet thief', '["someone stealing the duvet","losing the covers"]', 0, NULL);

-- ── Name 10 things you'd shout if you saw a spider
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('shout-at-a-spider', 'life', 'Name 10 things you''d shout if you saw a spider', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('shout-at-a-spider', 1, 'Spider!', '["spider","theres a spider"]', 0, NULL),
  ('shout-at-a-spider', 2, 'Help!', '["help","someone help"]', 0, NULL),
  ('shout-at-a-spider', 3, 'Get it!', '["get it","get rid of it"]', 0, NULL),
  ('shout-at-a-spider', 4, 'Kill it!', '["kill it"]', 0, NULL),
  ('shout-at-a-spider', 5, 'It moved!', '["it moved","it just moved"]', 0, NULL),
  ('shout-at-a-spider', 6, 'Where did it go?', '["where did it go","where has it gone","ive lost it"]', 0, NULL),
  ('shout-at-a-spider', 7, 'It''s huge!', '["its huge","its massive","its enormous"]', 0, NULL),
  ('shout-at-a-spider', 8, 'Get a glass!', '["get a glass","glass and a postcard","get a cup"]', 0, NULL),
  ('shout-at-a-spider', 9, 'Don''t let it near me!', '["dont let it near me","keep it away from me"]', 0, NULL),
  ('shout-at-a-spider', 10, 'Burn the house down!', '["burn the house down","were moving"]', 0, NULL),
  ('shout-at-a-spider', 11, 'I''m not going in there', '["im not going in there","that room is yours now"]', 0, NULL);

-- ── Name 10 things you should never say to a hairdresser
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('never-say-to-hairdresser', 'life', 'Name 10 things you should never say to a hairdresser', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('never-say-to-hairdresser', 1, 'Just a trim', '["just a little trim","only a trim"]', 0, NULL),
  ('never-say-to-hairdresser', 2, 'Do whatever you want', '["do whatever you like","surprise me"]', 0, NULL),
  ('never-say-to-hairdresser', 3, 'Make me look like her', '["make me look like this photo","i want it like hers"]', 0, NULL),
  ('never-say-to-hairdresser', 4, 'I cut it myself', '["i cut my own fringe","i had a go myself"]', 0, NULL),
  ('never-say-to-hairdresser', 5, 'I''ll know when I see it', '["ill know it when i see it"]', 0, NULL),
  ('never-say-to-hairdresser', 6, 'Same as last time', '["the usual","same as always"]', 0, NULL),
  ('never-say-to-hairdresser', 7, 'Just tidy it up', '["tidy it up a bit"]', 0, NULL),
  ('never-say-to-hairdresser', 8, 'Can you make it longer?', '["can you make it longer","can you add some length"]', 0, NULL),
  ('never-say-to-hairdresser', 9, 'Oh… that''s short', '["thats short","oh thats a bit short"]', 0, NULL),
  ('never-say-to-hairdresser', 10, 'My last hairdresser did it better', '["my old hairdresser did it differently"]', 0, NULL),
  ('never-say-to-hairdresser', 11, 'Can you fix what someone else did?', '["can you fix this","someone else ruined it"]', 0, NULL);

-- ── Name 10 things that make you instantly hungry
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('instantly-hungry', 'food', 'Name 10 things that make you instantly hungry', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('instantly-hungry', 1, 'The smell of bacon', '["bacon","frying bacon"]', 0, NULL),
  ('instantly-hungry', 2, 'Walking past a Greggs', '["greggs","a greggs"]', 0, NULL),
  ('instantly-hungry', 3, 'Cooking shows', '["a cooking programme","masterchef","bake off"]', 0, NULL),
  ('instantly-hungry', 4, 'The word "takeaway"', '["someone saying takeaway","the word takeaway"]', 0, NULL),
  ('instantly-hungry', 5, 'A chip shop', '["the chippy","a chippy","fish and chip shop"]', 0, NULL),
  ('instantly-hungry', 6, 'Popcorn in a cinema', '["cinema popcorn","popcorn"]', 0, NULL),
  ('instantly-hungry', 7, 'A Sunday roast', '["a roast","roast dinner"]', 0, NULL),
  ('instantly-hungry', 8, 'A food advert', '["adverts for food","a pizza advert"]', 0, NULL),
  ('instantly-hungry', 9, 'A barbecue', '["a bbq","someone having a barbecue"]', 0, NULL),
  ('instantly-hungry', 10, 'Cinnamon buns at the station', '["cinnamon buns","the cinnabon place"]', 0, NULL),
  ('instantly-hungry', 11, 'Fresh bread', '["the bakery aisle","bread baking"]', 0, NULL),
  ('instantly-hungry', 12, 'Someone else eating', '["watching someone eat"]', 0, NULL);

-- ── Name 10 things that should never be self-service
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('never-self-service', 'life', 'Name 10 things that should never be self-service', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('never-self-service', 1, 'Haircuts', '["cutting your own hair","a haircut"]', 0, NULL),
  ('never-self-service', 2, 'Dentistry', '["the dentist","your own teeth"]', 0, NULL),
  ('never-self-service', 3, 'Tattoos', '["tattooing yourself","a tattoo"]', 0, NULL),
  ('never-self-service', 4, 'Surgery', '["operating on yourself","an operation"]', 0, NULL),
  ('never-self-service', 5, 'Piercings', '["piercing yourself","a piercing"]', 0, NULL),
  ('never-self-service', 6, 'Brain scans', '["a brain scan","an mri"]', 0, NULL),
  ('never-self-service', 7, 'Flying the plane', '["airline pilots","being the pilot","flying a plane"]', 0, NULL),
  ('never-self-service', 8, 'Eyebrow threading', '["threading","doing your own eyebrows"]', 0, NULL),
  ('never-self-service', 9, 'Parachuting lessons', '["learning to parachute","a parachute lesson"]', 0, NULL),
  ('never-self-service', 10, 'Waxing', '["waxing yourself","a wax"]', 0, NULL),
  ('never-self-service', 11, 'Driving lessons', '["teaching yourself to drive","a driving lesson"]', 0, NULL),
  ('never-self-service', 12, 'Anaesthetic', '["putting yourself under","the anaesthetist"]', 0, NULL);

-- ── Name 10 things that go "ding"
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('things-that-go-ding', 'life', 'Name 10 things that go "ding"', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('things-that-go-ding', 1, 'A microwave', '["microwave","the microwave"]', 0, NULL),
  ('things-that-go-ding', 2, 'A lift', '["the lift","an elevator"]', 0, NULL),
  ('things-that-go-ding', 3, 'A doorbell', '["doorbell","the doorbell"]', 0, NULL),
  ('things-that-go-ding', 4, 'An oven timer', '["oven timer","the oven"]', 0, NULL),
  ('things-that-go-ding', 5, 'A phone notification', '["a notification","your phone","a text"]', 0, NULL),
  ('things-that-go-ding', 6, 'A boxing bell', '["the bell at the boxing","a ring bell"]', 0, NULL),
  ('things-that-go-ding', 7, 'A bike bell', '["a bell on a bike","bicycle bell"]', 0, NULL),
  ('things-that-go-ding', 8, 'A toaster', '["the toaster","toast popping up"]', 0, NULL),
  ('things-that-go-ding', 9, 'A typewriter', '["a typewriter return","the typewriter bell"]', 0, NULL),
  ('things-that-go-ding', 10, 'The seatbelt sign', '["fasten seatbelt sign","the seatbelt light"]', 0, NULL),
  ('things-that-go-ding', 11, 'A till', '["the till","a cash register"]', 0, NULL),
  ('things-that-go-ding', 12, 'A hotel reception bell', '["the bell on a desk","reception bell"]', 0, NULL);

-- ── Name 10 phrases you hear in a meeting that should've been an email
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('should-have-been-an-email', 'life', 'Name 10 phrases you hear in a meeting that should''ve been an email', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('should-have-been-an-email', 1, 'Let''s circle back', '["lets circle back","circle back"]', 0, NULL),
  ('should-have-been-an-email', 2, 'Can everyone see my screen?', '["can everyone see my screen","can you see my screen"]', 0, NULL),
  ('should-have-been-an-email', 3, 'You''re on mute', '["youre on mute","on mute"]', 0, NULL),
  ('should-have-been-an-email', 4, 'Let''s take this offline', '["lets take this offline","take it offline"]', 0, NULL),
  ('should-have-been-an-email', 5, 'Just to add to that', '["just adding to that","building on that"]', 0, NULL),
  ('should-have-been-an-email', 6, 'Any questions?', '["any questions","questions at the end"]', 0, NULL),
  ('should-have-been-an-email', 7, 'Quick one', '["just a quick one","this will be quick"]', 0, NULL),
  ('should-have-been-an-email', 8, 'Can you hear me?', '["can you hear me","am i audible"]', 0, NULL),
  ('should-have-been-an-email', 9, 'Going forward', '["moving forward"]', 0, NULL),
  ('should-have-been-an-email', 10, 'Let''s park that', '["lets park that","park that for now"]', 0, NULL),
  ('should-have-been-an-email', 11, 'Sorry, you go', '["no you go","sorry you go first","after you"]', 0, NULL),
  ('should-have-been-an-email', 12, 'Let''s touch base', '["touch base"]', 0, NULL);

INSERT OR IGNORE INTO tenable_rounds (category, type, params, metric, title, answer_count)
SELECT 'general', 'general', '{"round":"' || r.slug || '"}', 'none', r.title,
       (SELECT COUNT(*) FROM general_answers a WHERE a.round_slug = r.slug)
FROM general_rounds r;
