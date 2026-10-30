-- Thirty-five rounds of food, and America.
--
-- The food rounds are the easy half: pizza toppings, a curry house menu, biscuits,
-- bread, apples, cuts of meat, coffee orders, what you do to a potato. They want
-- generous aliases rather than exact names, because a sandwich filling has no
-- official spelling — somebody will say "cheese pickle", not "cheese and pickle".
--
-- The American rounds are the useful half, because this category was almost
-- entirely British and a round about Hobnobs is no use to half a room. Brands,
-- a diner breakfast, Thanksgiving, landmarks, national parks, state and city
-- nicknames, who is on the money, the NFL and the NBA, and five ranked rounds
-- of state facts.
--
-- The team rounds name the city as well as the team but alias the team on its
-- own, for the same reason the actor rounds alias the surname: nobody says
-- "Tampa Bay Buccaneers".
--
-- One thing worth knowing about the ranked state facts. "The first 10 states to
-- join the Union" has nine of its ten in the same year, so the order inside
-- 1788 is the order they ratified and nothing on the board explains that. It is
-- a hard round on purpose.


-- ── Name 10 pizza toppings
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('pizza-toppings', 'food', 'Name 10 pizza toppings', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('pizza-toppings', 1, 'Pepperoni', NULL, 0, NULL),
  ('pizza-toppings', 2, 'Mushrooms', NULL, 0, NULL),
  ('pizza-toppings', 3, 'Ham', NULL, 0, NULL),
  ('pizza-toppings', 4, 'Pineapple', NULL, 0, NULL),
  ('pizza-toppings', 5, 'Olives', NULL, 0, NULL),
  ('pizza-toppings', 6, 'Onion', NULL, 0, NULL),
  ('pizza-toppings', 7, 'Peppers', NULL, 0, NULL),
  ('pizza-toppings', 8, 'Sweetcorn', NULL, 0, NULL),
  ('pizza-toppings', 9, 'Chicken', NULL, 0, NULL),
  ('pizza-toppings', 10, 'Sausage', NULL, 0, NULL),
  ('pizza-toppings', 11, 'Bacon', NULL, 0, NULL),
  ('pizza-toppings', 12, 'Anchovies', NULL, 0, NULL),
  ('pizza-toppings', 13, 'Spinach', NULL, 0, NULL),
  ('pizza-toppings', 14, 'Jalapenos', NULL, 0, NULL),
  ('pizza-toppings', 15, 'Tuna', NULL, 0, NULL),
  ('pizza-toppings', 16, 'Chorizo', NULL, 0, NULL),
  ('pizza-toppings', 17, 'Rocket', '["Arugula"]', 0, NULL),
  ('pizza-toppings', 18, 'Goat cheese', NULL, 0, NULL),
  ('pizza-toppings', 19, 'Prosciutto', NULL, 0, NULL),
  ('pizza-toppings', 20, 'Capers', NULL, 0, NULL);

-- ── Name 10 dishes on a curry house menu
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('curry-house-dishes', 'food', 'Name 10 dishes on a curry house menu', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('curry-house-dishes', 1, 'Chicken tikka masala', '["Tikka masala"]', 0, NULL),
  ('curry-house-dishes', 2, 'Korma', NULL, 0, NULL),
  ('curry-house-dishes', 3, 'Vindaloo', NULL, 0, NULL),
  ('curry-house-dishes', 4, 'Jalfrezi', NULL, 0, NULL),
  ('curry-house-dishes', 5, 'Madras', NULL, 0, NULL),
  ('curry-house-dishes', 6, 'Rogan josh', NULL, 0, NULL),
  ('curry-house-dishes', 7, 'Balti', NULL, 0, NULL),
  ('curry-house-dishes', 8, 'Bhuna', NULL, 0, NULL),
  ('curry-house-dishes', 9, 'Dhansak', NULL, 0, NULL),
  ('curry-house-dishes', 10, 'Pasanda', NULL, 0, NULL),
  ('curry-house-dishes', 11, 'Saag aloo', NULL, 0, NULL),
  ('curry-house-dishes', 12, 'Tarka dal', '["Dal"]', 0, NULL),
  ('curry-house-dishes', 13, 'Onion bhaji', '["Bhaji"]', 0, NULL),
  ('curry-house-dishes', 14, 'Samosa', NULL, 0, NULL),
  ('curry-house-dishes', 15, 'Naan', NULL, 0, NULL),
  ('curry-house-dishes', 16, 'Pilau rice', '["Pilau"]', 0, NULL),
  ('curry-house-dishes', 17, 'Poppadom', NULL, 0, NULL),
  ('curry-house-dishes', 18, 'Biryani', NULL, 0, NULL),
  ('curry-house-dishes', 19, 'Dopiaza', NULL, 0, NULL),
  ('curry-house-dishes', 20, 'Phall', NULL, 0, NULL);

-- ── Name 10 British puddings
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('british-puddings', 'food', 'Name 10 British puddings', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('british-puddings', 1, 'Sticky toffee pudding', '["Sticky toffee"]', 0, NULL),
  ('british-puddings', 2, 'Spotted dick', NULL, 0, NULL),
  ('british-puddings', 3, 'Eton mess', NULL, 0, NULL),
  ('british-puddings', 4, 'Trifle', NULL, 0, NULL),
  ('british-puddings', 5, 'Bread and butter pudding', NULL, 0, NULL),
  ('british-puddings', 6, 'Treacle tart', NULL, 0, NULL),
  ('british-puddings', 7, 'Jam roly-poly', '["Roly poly"]', 0, NULL),
  ('british-puddings', 8, 'Crumble', NULL, 0, NULL),
  ('british-puddings', 9, 'Rice pudding', NULL, 0, NULL),
  ('british-puddings', 10, 'Bakewell tart', '["Bakewell"]', 0, NULL),
  ('british-puddings', 11, 'Banoffee pie', '["Banoffee"]', 0, NULL),
  ('british-puddings', 12, 'Custard tart', NULL, 0, NULL),
  ('british-puddings', 13, 'Summer pudding', NULL, 0, NULL),
  ('british-puddings', 14, 'Syrup sponge', NULL, 0, NULL),
  ('british-puddings', 15, 'Knickerbocker glory', NULL, 0, NULL),
  ('british-puddings', 16, 'Arctic roll', NULL, 0, NULL),
  ('british-puddings', 17, 'Lemon meringue pie', '["Lemon meringue"]', 0, NULL),
  ('british-puddings', 18, 'Queen of puddings', NULL, 0, NULL);

-- ── Name 10 biscuits sold in the UK
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('uk-biscuits', 'food', 'Name 10 biscuits sold in the UK', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('uk-biscuits', 1, 'Digestive', NULL, 0, NULL),
  ('uk-biscuits', 2, 'Hobnob', NULL, 0, NULL),
  ('uk-biscuits', 3, 'Custard cream', NULL, 0, NULL),
  ('uk-biscuits', 4, 'Bourbon', NULL, 0, NULL),
  ('uk-biscuits', 5, 'Jammie Dodger', NULL, 0, NULL),
  ('uk-biscuits', 6, 'Rich Tea', NULL, 0, NULL),
  ('uk-biscuits', 7, 'Garibaldi', NULL, 0, NULL),
  ('uk-biscuits', 8, 'Ginger nut', NULL, 0, NULL),
  ('uk-biscuits', 9, 'Shortbread', NULL, 0, NULL),
  ('uk-biscuits', 10, 'Party ring', NULL, 0, NULL),
  ('uk-biscuits', 11, 'Nice', NULL, 0, NULL),
  ('uk-biscuits', 12, 'Malted Milk', NULL, 0, NULL),
  ('uk-biscuits', 13, 'Pink Wafer', NULL, 0, NULL),
  ('uk-biscuits', 14, 'Viscount', NULL, 0, NULL),
  ('uk-biscuits', 15, 'Club', NULL, 0, NULL),
  ('uk-biscuits', 16, 'Penguin', NULL, 0, NULL),
  ('uk-biscuits', 17, 'Jaffa Cake', NULL, 0, NULL),
  ('uk-biscuits', 18, 'Fig roll', NULL, 0, NULL),
  ('uk-biscuits', 19, 'Oreo', NULL, 0, NULL),
  ('uk-biscuits', 20, 'Chocolate finger', NULL, 0, NULL);

-- ── Name 10 sandwich fillings
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('sandwich-fillings', 'food', 'Name 10 sandwich fillings', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('sandwich-fillings', 1, 'Cheese and pickle', '["Cheese pickle"]', 0, NULL),
  ('sandwich-fillings', 2, 'Ham and mustard', '["Ham mustard"]', 0, NULL),
  ('sandwich-fillings', 3, 'Tuna mayo', NULL, 0, NULL),
  ('sandwich-fillings', 4, 'Egg mayo', NULL, 0, NULL),
  ('sandwich-fillings', 5, 'Chicken salad', NULL, 0, NULL),
  ('sandwich-fillings', 6, 'BLT', NULL, 0, NULL),
  ('sandwich-fillings', 7, 'Coronation chicken', NULL, 0, NULL),
  ('sandwich-fillings', 8, 'Prawn mayo', NULL, 0, NULL),
  ('sandwich-fillings', 9, 'Cheese and ham', NULL, 0, NULL),
  ('sandwich-fillings', 10, 'Peanut butter', NULL, 0, NULL),
  ('sandwich-fillings', 11, 'Jam', NULL, 0, NULL),
  ('sandwich-fillings', 12, 'Beef and horseradish', '["Horseradish"]', 0, NULL),
  ('sandwich-fillings', 13, 'Turkey and cranberry', NULL, 0, NULL),
  ('sandwich-fillings', 14, 'Bacon', NULL, 0, NULL),
  ('sandwich-fillings', 15, 'Sausage', NULL, 0, NULL),
  ('sandwich-fillings', 16, 'Chip butty', '["Chips"]', 0, NULL),
  ('sandwich-fillings', 17, 'Hummus', NULL, 0, NULL),
  ('sandwich-fillings', 18, 'Brie and bacon', NULL, 0, NULL),
  ('sandwich-fillings', 19, 'Marmite', NULL, 0, NULL),
  ('sandwich-fillings', 20, 'Cucumber', NULL, 0, NULL);

-- ── Name 10 cuts of meat
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('cuts-of-meat', 'food', 'Name 10 cuts of meat', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('cuts-of-meat', 1, 'Sirloin', NULL, 0, NULL),
  ('cuts-of-meat', 2, 'Ribeye', NULL, 0, NULL),
  ('cuts-of-meat', 3, 'Fillet', NULL, 0, NULL),
  ('cuts-of-meat', 4, 'Rump', NULL, 0, NULL),
  ('cuts-of-meat', 5, 'Brisket', NULL, 0, NULL),
  ('cuts-of-meat', 6, 'Chuck', NULL, 0, NULL),
  ('cuts-of-meat', 7, 'Flank', NULL, 0, NULL),
  ('cuts-of-meat', 8, 'Shin', NULL, 0, NULL),
  ('cuts-of-meat', 9, 'Topside', NULL, 0, NULL),
  ('cuts-of-meat', 10, 'Silverside', NULL, 0, NULL),
  ('cuts-of-meat', 11, 'T-bone', '["T bone"]', 0, NULL),
  ('cuts-of-meat', 12, 'Short rib', NULL, 0, NULL),
  ('cuts-of-meat', 13, 'Skirt', NULL, 0, NULL),
  ('cuts-of-meat', 14, 'Oxtail', NULL, 0, NULL),
  ('cuts-of-meat', 15, 'Tenderloin', NULL, 0, NULL),
  ('cuts-of-meat', 16, 'Loin', NULL, 0, NULL),
  ('cuts-of-meat', 17, 'Belly', NULL, 0, NULL),
  ('cuts-of-meat', 18, 'Shoulder', NULL, 0, NULL),
  ('cuts-of-meat', 19, 'Shank', NULL, 0, NULL),
  ('cuts-of-meat', 20, 'Porterhouse', NULL, 0, NULL);

-- ── Name 10 types of bread
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('types-of-bread', 'food', 'Name 10 types of bread', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('types-of-bread', 1, 'Sourdough', NULL, 0, NULL),
  ('types-of-bread', 2, 'Baguette', NULL, 0, NULL),
  ('types-of-bread', 3, 'Ciabatta', NULL, 0, NULL),
  ('types-of-bread', 4, 'Focaccia', NULL, 0, NULL),
  ('types-of-bread', 5, 'Rye', NULL, 0, NULL),
  ('types-of-bread', 6, 'Pumpernickel', NULL, 0, NULL),
  ('types-of-bread', 7, 'Naan', NULL, 0, NULL),
  ('types-of-bread', 8, 'Pitta', NULL, 0, NULL),
  ('types-of-bread', 9, 'Brioche', NULL, 0, NULL),
  ('types-of-bread', 10, 'Bagel', NULL, 0, NULL),
  ('types-of-bread', 11, 'Challah', NULL, 0, NULL),
  ('types-of-bread', 12, 'Tortilla', NULL, 0, NULL),
  ('types-of-bread', 13, 'Soda bread', NULL, 0, NULL),
  ('types-of-bread', 14, 'Cornbread', NULL, 0, NULL),
  ('types-of-bread', 15, 'Wholemeal', NULL, 0, NULL),
  ('types-of-bread', 16, 'Granary', NULL, 0, NULL),
  ('types-of-bread', 17, 'Bloomer', NULL, 0, NULL),
  ('types-of-bread', 18, 'Flatbread', NULL, 0, NULL),
  ('types-of-bread', 19, 'Chapati', NULL, 0, NULL),
  ('types-of-bread', 20, 'Crumpet', NULL, 0, NULL);

-- ── Name 10 varieties of apple
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('types-of-apple', 'food', 'Name 10 varieties of apple', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('types-of-apple', 1, 'Granny Smith', NULL, 0, NULL),
  ('types-of-apple', 2, 'Gala', NULL, 0, NULL),
  ('types-of-apple', 3, 'Pink Lady', NULL, 0, NULL),
  ('types-of-apple', 4, 'Braeburn', NULL, 0, NULL),
  ('types-of-apple', 5, 'Fuji', NULL, 0, NULL),
  ('types-of-apple', 6, 'Honeycrisp', NULL, 0, NULL),
  ('types-of-apple', 7, 'Golden Delicious', NULL, 0, NULL),
  ('types-of-apple', 8, 'Red Delicious', NULL, 0, NULL),
  ('types-of-apple', 9, 'Cox', NULL, 0, NULL),
  ('types-of-apple', 10, 'Bramley', NULL, 0, NULL),
  ('types-of-apple', 11, 'Jazz', NULL, 0, NULL),
  ('types-of-apple', 12, 'Envy', NULL, 0, NULL),
  ('types-of-apple', 13, 'McIntosh', NULL, 0, NULL),
  ('types-of-apple', 14, 'Empire', NULL, 0, NULL),
  ('types-of-apple', 15, 'Russet', NULL, 0, NULL),
  ('types-of-apple', 16, 'Discovery', NULL, 0, NULL),
  ('types-of-apple', 17, 'Egremont', NULL, 0, NULL),
  ('types-of-apple', 18, 'Katy', NULL, 0, NULL);

-- ── Name 10 ways to order a coffee
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('coffee-orders', 'food', 'Name 10 ways to order a coffee', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('coffee-orders', 1, 'Espresso', NULL, 0, NULL),
  ('coffee-orders', 2, 'Americano', NULL, 0, NULL),
  ('coffee-orders', 3, 'Latte', NULL, 0, NULL),
  ('coffee-orders', 4, 'Cappuccino', NULL, 0, NULL),
  ('coffee-orders', 5, 'Flat white', NULL, 0, NULL),
  ('coffee-orders', 6, 'Macchiato', NULL, 0, NULL),
  ('coffee-orders', 7, 'Mocha', NULL, 0, NULL),
  ('coffee-orders', 8, 'Cortado', NULL, 0, NULL),
  ('coffee-orders', 9, 'Ristretto', NULL, 0, NULL),
  ('coffee-orders', 10, 'Affogato', NULL, 0, NULL),
  ('coffee-orders', 11, 'Cold brew', NULL, 0, NULL),
  ('coffee-orders', 12, 'Iced latte', NULL, 0, NULL),
  ('coffee-orders', 13, 'Frappe', NULL, 0, NULL),
  ('coffee-orders', 14, 'Filter', NULL, 0, NULL),
  ('coffee-orders', 15, 'Long black', NULL, 0, NULL),
  ('coffee-orders', 16, 'Piccolo', NULL, 0, NULL),
  ('coffee-orders', 17, 'Doppio', NULL, 0, NULL),
  ('coffee-orders', 18, 'Lungo', NULL, 0, NULL);

-- ── Name 10 ways to cook something
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('cooking-methods', 'food', 'Name 10 ways to cook something', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('cooking-methods', 1, 'Bake', NULL, 0, NULL),
  ('cooking-methods', 2, 'Roast', NULL, 0, NULL),
  ('cooking-methods', 3, 'Fry', NULL, 0, NULL),
  ('cooking-methods', 4, 'Deep fry', NULL, 0, NULL),
  ('cooking-methods', 5, 'Grill', NULL, 0, NULL),
  ('cooking-methods', 6, 'Broil', NULL, 0, NULL),
  ('cooking-methods', 7, 'Boil', NULL, 0, NULL),
  ('cooking-methods', 8, 'Simmer', NULL, 0, NULL),
  ('cooking-methods', 9, 'Poach', NULL, 0, NULL),
  ('cooking-methods', 10, 'Steam', NULL, 0, NULL),
  ('cooking-methods', 11, 'Saute', NULL, 0, NULL),
  ('cooking-methods', 12, 'Braise', NULL, 0, NULL),
  ('cooking-methods', 13, 'Stew', NULL, 0, NULL),
  ('cooking-methods', 14, 'Barbecue', NULL, 0, NULL),
  ('cooking-methods', 15, 'Smoke', NULL, 0, NULL),
  ('cooking-methods', 16, 'Sous vide', NULL, 0, NULL),
  ('cooking-methods', 17, 'Blanch', NULL, 0, NULL),
  ('cooking-methods', 18, 'Confit', NULL, 0, NULL),
  ('cooking-methods', 19, 'Griddle', NULL, 0, NULL),
  ('cooking-methods', 20, 'Microwave', NULL, 0, NULL);

-- ── Name 10 kitchen utensils
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('kitchen-utensils', 'food', 'Name 10 kitchen utensils', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('kitchen-utensils', 1, 'Whisk', NULL, 0, NULL),
  ('kitchen-utensils', 2, 'Spatula', NULL, 0, NULL),
  ('kitchen-utensils', 3, 'Ladle', NULL, 0, NULL),
  ('kitchen-utensils', 4, 'Tongs', NULL, 0, NULL),
  ('kitchen-utensils', 5, 'Peeler', NULL, 0, NULL),
  ('kitchen-utensils', 6, 'Grater', NULL, 0, NULL),
  ('kitchen-utensils', 7, 'Colander', NULL, 0, NULL),
  ('kitchen-utensils', 8, 'Sieve', NULL, 0, NULL),
  ('kitchen-utensils', 9, 'Rolling pin', NULL, 0, NULL),
  ('kitchen-utensils', 10, 'Masher', NULL, 0, NULL),
  ('kitchen-utensils', 11, 'Corkscrew', NULL, 0, NULL),
  ('kitchen-utensils', 12, 'Tin opener', '["Can opener"]', 0, NULL),
  ('kitchen-utensils', 13, 'Measuring jug', NULL, 0, NULL),
  ('kitchen-utensils', 14, 'Chopping board', NULL, 0, NULL),
  ('kitchen-utensils', 15, 'Slotted spoon', NULL, 0, NULL),
  ('kitchen-utensils', 16, 'Pestle and mortar', '["Pestle"]', 0, NULL),
  ('kitchen-utensils', 17, 'Garlic press', NULL, 0, NULL),
  ('kitchen-utensils', 18, 'Thermometer', NULL, 0, NULL),
  ('kitchen-utensils', 19, 'Whetstone', NULL, 0, NULL),
  ('kitchen-utensils', 20, 'Baster', NULL, 0, NULL);

-- ── Name 10 ice cream flavours
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('ice-cream-flavours', 'food', 'Name 10 ice cream flavours', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('ice-cream-flavours', 1, 'Vanilla', NULL, 0, NULL),
  ('ice-cream-flavours', 2, 'Chocolate', NULL, 0, NULL),
  ('ice-cream-flavours', 3, 'Strawberry', NULL, 0, NULL),
  ('ice-cream-flavours', 4, 'Mint choc chip', '["Mint chocolate chip"]', 0, NULL),
  ('ice-cream-flavours', 5, 'Cookie dough', NULL, 0, NULL),
  ('ice-cream-flavours', 6, 'Rum and raisin', NULL, 0, NULL),
  ('ice-cream-flavours', 7, 'Pistachio', NULL, 0, NULL),
  ('ice-cream-flavours', 8, 'Salted caramel', NULL, 0, NULL),
  ('ice-cream-flavours', 9, 'Rocky road', NULL, 0, NULL),
  ('ice-cream-flavours', 10, 'Butter pecan', NULL, 0, NULL),
  ('ice-cream-flavours', 11, 'Cookies and cream', NULL, 0, NULL),
  ('ice-cream-flavours', 12, 'Neapolitan', NULL, 0, NULL),
  ('ice-cream-flavours', 13, 'Toffee', NULL, 0, NULL),
  ('ice-cream-flavours', 14, 'Coffee', NULL, 0, NULL),
  ('ice-cream-flavours', 15, 'Mango', NULL, 0, NULL),
  ('ice-cream-flavours', 16, 'Raspberry ripple', NULL, 0, NULL),
  ('ice-cream-flavours', 17, 'Banana', NULL, 0, NULL),
  ('ice-cream-flavours', 18, 'Honeycomb', NULL, 0, NULL);

-- ── Name 10 things in a full English breakfast
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('full-english', 'food', 'Name 10 things in a full English breakfast', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('full-english', 1, 'Bacon', NULL, 0, NULL),
  ('full-english', 2, 'Sausage', NULL, 0, NULL),
  ('full-english', 3, 'Fried egg', '["Egg"]', 0, NULL),
  ('full-english', 4, 'Baked beans', '["Beans"]', 0, NULL),
  ('full-english', 5, 'Black pudding', NULL, 0, NULL),
  ('full-english', 6, 'Mushrooms', NULL, 0, NULL),
  ('full-english', 7, 'Grilled tomato', '["Tomato"]', 0, NULL),
  ('full-english', 8, 'Hash browns', NULL, 0, NULL),
  ('full-english', 9, 'Fried bread', NULL, 0, NULL),
  ('full-english', 10, 'Toast', NULL, 0, NULL),
  ('full-english', 11, 'Bubble and squeak', '["Bubble"]', 0, NULL),
  ('full-english', 12, 'White pudding', NULL, 0, NULL),
  ('full-english', 13, 'Potato scone', '["Tattie scone"]', 0, NULL),
  ('full-english', 14, 'Brown sauce', NULL, 0, NULL);

-- ── Name 10 types of fish you can eat
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('types-of-fish', 'food', 'Name 10 types of fish you can eat', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('types-of-fish', 1, 'Cod', NULL, 0, NULL),
  ('types-of-fish', 2, 'Haddock', NULL, 0, NULL),
  ('types-of-fish', 3, 'Salmon', NULL, 0, NULL),
  ('types-of-fish', 4, 'Tuna', NULL, 0, NULL),
  ('types-of-fish', 5, 'Mackerel', NULL, 0, NULL),
  ('types-of-fish', 6, 'Sardine', NULL, 0, NULL),
  ('types-of-fish', 7, 'Trout', NULL, 0, NULL),
  ('types-of-fish', 8, 'Plaice', NULL, 0, NULL),
  ('types-of-fish', 9, 'Sole', NULL, 0, NULL),
  ('types-of-fish', 10, 'Sea bass', NULL, 0, NULL),
  ('types-of-fish', 11, 'Halibut', NULL, 0, NULL),
  ('types-of-fish', 12, 'Snapper', NULL, 0, NULL),
  ('types-of-fish', 13, 'Anchovy', NULL, 0, NULL),
  ('types-of-fish', 14, 'Herring', NULL, 0, NULL),
  ('types-of-fish', 15, 'Pollock', NULL, 0, NULL),
  ('types-of-fish', 16, 'Monkfish', NULL, 0, NULL),
  ('types-of-fish', 17, 'Turbot', NULL, 0, NULL),
  ('types-of-fish', 18, 'Bream', NULL, 0, NULL),
  ('types-of-fish', 19, 'Hake', NULL, 0, NULL),
  ('types-of-fish', 20, 'Swordfish', NULL, 0, NULL);

-- ── Name 10 ways to serve a potato
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('potato-dishes', 'food', 'Name 10 ways to serve a potato', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('potato-dishes', 1, 'Chips', NULL, 0, NULL),
  ('potato-dishes', 2, 'Mash', NULL, 0, NULL),
  ('potato-dishes', 3, 'Roast potatoes', '["Roasties"]', 0, NULL),
  ('potato-dishes', 4, 'Jacket potato', '["Baked potato"]', 0, NULL),
  ('potato-dishes', 5, 'Dauphinoise', NULL, 0, NULL),
  ('potato-dishes', 6, 'Hash brown', NULL, 0, NULL),
  ('potato-dishes', 7, 'Croquette', NULL, 0, NULL),
  ('potato-dishes', 8, 'Wedges', NULL, 0, NULL),
  ('potato-dishes', 9, 'Gnocchi', NULL, 0, NULL),
  ('potato-dishes', 10, 'Rosti', NULL, 0, NULL),
  ('potato-dishes', 11, 'Tater tots', '["Tots"]', 0, NULL),
  ('potato-dishes', 12, 'Boiled', NULL, 0, NULL),
  ('potato-dishes', 13, 'Fondant', NULL, 0, NULL),
  ('potato-dishes', 14, 'Crisps', NULL, 0, NULL),
  ('potato-dishes', 15, 'Potato salad', NULL, 0, NULL),
  ('potato-dishes', 16, 'Bubble and squeak', NULL, 0, NULL),
  ('potato-dishes', 17, 'Hasselback', NULL, 0, NULL),
  ('potato-dishes', 18, 'Chip butty', NULL, 0, NULL);

-- ── Name 10 chocolate bars sold in the US
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-chocolate-bars', 'food', 'Name 10 chocolate bars sold in the US', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-chocolate-bars', 1, 'Hershey''s', '["Hershey"]', 0, NULL),
  ('us-chocolate-bars', 2, 'Snickers', NULL, 0, NULL),
  ('us-chocolate-bars', 3, 'Reese''s', '["Reeses Peanut Butter Cups"]', 0, NULL),
  ('us-chocolate-bars', 4, 'Milky Way', NULL, 0, NULL),
  ('us-chocolate-bars', 5, 'Butterfinger', NULL, 0, NULL),
  ('us-chocolate-bars', 6, 'Almond Joy', NULL, 0, NULL),
  ('us-chocolate-bars', 7, 'Mounds', NULL, 0, NULL),
  ('us-chocolate-bars', 8, 'Baby Ruth', NULL, 0, NULL),
  ('us-chocolate-bars', 9, '3 Musketeers', '["Three Musketeers"]', 0, NULL),
  ('us-chocolate-bars', 10, 'Twix', NULL, 0, NULL),
  ('us-chocolate-bars', 11, 'Kit Kat', NULL, 0, NULL),
  ('us-chocolate-bars', 12, 'Heath Bar', '["Heath"]', 0, NULL),
  ('us-chocolate-bars', 13, 'Whatchamacallit', NULL, 0, NULL),
  ('us-chocolate-bars', 14, 'PayDay', NULL, 0, NULL),
  ('us-chocolate-bars', 15, 'Take 5', NULL, 0, NULL),
  ('us-chocolate-bars', 16, 'Nestle Crunch', '["Crunch"]', 0, NULL),
  ('us-chocolate-bars', 17, '100 Grand', NULL, 0, NULL),
  ('us-chocolate-bars', 18, 'Mr. Goodbar', '["Goodbar"]', 0, NULL),
  ('us-chocolate-bars', 19, 'Krackel', NULL, 0, NULL),
  ('us-chocolate-bars', 20, 'Rolo', NULL, 0, NULL),
  ('us-chocolate-bars', 21, 'Skor', NULL, 0, NULL),
  ('us-chocolate-bars', 22, 'Charleston Chew', NULL, 0, NULL);

-- ── Name 10 fast food chains in the US
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-fast-food-chains', 'food', 'Name 10 fast food chains in the US', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-fast-food-chains', 1, 'McDonald''s', '["McDonalds"]', 0, NULL),
  ('us-fast-food-chains', 2, 'Burger King', NULL, 0, NULL),
  ('us-fast-food-chains', 3, 'Wendy''s', '["Wendys"]', 0, NULL),
  ('us-fast-food-chains', 4, 'Taco Bell', NULL, 0, NULL),
  ('us-fast-food-chains', 5, 'KFC', NULL, 0, NULL),
  ('us-fast-food-chains', 6, 'Chick-fil-A', '["Chick fil A"]', 0, NULL),
  ('us-fast-food-chains', 7, 'Subway', NULL, 0, NULL),
  ('us-fast-food-chains', 8, 'Chipotle', NULL, 0, NULL),
  ('us-fast-food-chains', 9, 'Popeyes', NULL, 0, NULL),
  ('us-fast-food-chains', 10, 'Arby''s', '["Arbys"]', 0, NULL),
  ('us-fast-food-chains', 11, 'Sonic', NULL, 0, NULL),
  ('us-fast-food-chains', 12, 'Dairy Queen', NULL, 0, NULL),
  ('us-fast-food-chains', 13, 'Jack in the Box', NULL, 0, NULL),
  ('us-fast-food-chains', 14, 'Five Guys', NULL, 0, NULL),
  ('us-fast-food-chains', 15, 'In-N-Out', '["In N Out"]', 0, NULL),
  ('us-fast-food-chains', 16, 'Whataburger', NULL, 0, NULL),
  ('us-fast-food-chains', 17, 'Shake Shack', NULL, 0, NULL),
  ('us-fast-food-chains', 18, 'Culver''s', '["Culvers"]', 0, NULL),
  ('us-fast-food-chains', 19, 'White Castle', NULL, 0, NULL),
  ('us-fast-food-chains', 20, 'Hardee''s', '["Hardees"]', 0, NULL),
  ('us-fast-food-chains', 21, 'Carl''s Jr', '["Carls Jr"]', 0, NULL),
  ('us-fast-food-chains', 22, 'Panda Express', NULL, 0, NULL),
  ('us-fast-food-chains', 23, 'Raising Cane''s', '["Raising Canes"]', 0, NULL),
  ('us-fast-food-chains', 24, 'Zaxby''s', '["Zaxbys"]', 0, NULL);

-- ── Name 10 things on an American diner breakfast menu
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-diner-breakfast', 'food', 'Name 10 things on an American diner breakfast menu', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-diner-breakfast', 1, 'Pancakes', NULL, 0, NULL),
  ('us-diner-breakfast', 2, 'Waffles', NULL, 0, NULL),
  ('us-diner-breakfast', 3, 'Hash browns', NULL, 0, NULL),
  ('us-diner-breakfast', 4, 'Bacon', NULL, 0, NULL),
  ('us-diner-breakfast', 5, 'Sausage', NULL, 0, NULL),
  ('us-diner-breakfast', 6, 'Biscuits and gravy', '["Biscuits"]', 0, NULL),
  ('us-diner-breakfast', 7, 'Grits', NULL, 0, NULL),
  ('us-diner-breakfast', 8, 'Home fries', NULL, 0, NULL),
  ('us-diner-breakfast', 9, 'Eggs Benedict', '["Benedict"]', 0, NULL),
  ('us-diner-breakfast', 10, 'French toast', NULL, 0, NULL),
  ('us-diner-breakfast', 11, 'Omelette', '["Omelet"]', 0, NULL),
  ('us-diner-breakfast', 12, 'Corned beef hash', NULL, 0, NULL),
  ('us-diner-breakfast', 13, 'Bagel', NULL, 0, NULL),
  ('us-diner-breakfast', 14, 'English muffin', NULL, 0, NULL),
  ('us-diner-breakfast', 15, 'Cinnamon roll', NULL, 0, NULL),
  ('us-diner-breakfast', 16, 'Oatmeal', NULL, 0, NULL),
  ('us-diner-breakfast', 17, 'Scrambled eggs', NULL, 0, NULL),
  ('us-diner-breakfast', 18, 'Sunny side up', NULL, 0, NULL),
  ('us-diner-breakfast', 19, 'Toast', NULL, 0, NULL),
  ('us-diner-breakfast', 20, 'Coffee', NULL, 0, NULL);

-- ── Name 10 American soda brands
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-soda-brands', 'food', 'Name 10 American soda brands', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-soda-brands', 1, 'Coca-Cola', '["Coke"]', 0, NULL),
  ('us-soda-brands', 2, 'Pepsi', NULL, 0, NULL),
  ('us-soda-brands', 3, 'Dr Pepper', NULL, 0, NULL),
  ('us-soda-brands', 4, 'Mountain Dew', NULL, 0, NULL),
  ('us-soda-brands', 5, 'Sprite', NULL, 0, NULL),
  ('us-soda-brands', 6, 'Fanta', NULL, 0, NULL),
  ('us-soda-brands', 7, '7 Up', '["Seven Up"]', 0, NULL),
  ('us-soda-brands', 8, 'A&W', '["A and W"]', 0, NULL),
  ('us-soda-brands', 9, 'Sunkist', NULL, 0, NULL),
  ('us-soda-brands', 10, 'Mug', NULL, 0, NULL),
  ('us-soda-brands', 11, 'Barq’s', '["Barqs"]', 0, NULL),
  ('us-soda-brands', 12, 'Squirt', NULL, 0, NULL),
  ('us-soda-brands', 13, 'Faygo', NULL, 0, NULL),
  ('us-soda-brands', 14, 'Shasta', NULL, 0, NULL),
  ('us-soda-brands', 15, 'Jarritos', NULL, 0, NULL),
  ('us-soda-brands', 16, 'RC Cola', '["Royal Crown"]', 0, NULL),
  ('us-soda-brands', 17, 'Cheerwine', NULL, 0, NULL),
  ('us-soda-brands', 18, 'Moxie', NULL, 0, NULL),
  ('us-soda-brands', 19, 'Vernors', NULL, 0, NULL),
  ('us-soda-brands', 20, 'Canada Dry', NULL, 0, NULL),
  ('us-soda-brands', 21, 'Schweppes', NULL, 0, NULL),
  ('us-soda-brands', 22, 'Crush', NULL, 0, NULL);

-- ── Name 10 things on a Thanksgiving table
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-thanksgiving', 'food', 'Name 10 things on a Thanksgiving table', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-thanksgiving', 1, 'Turkey', NULL, 0, NULL),
  ('us-thanksgiving', 2, 'Stuffing', NULL, 0, NULL),
  ('us-thanksgiving', 3, 'Mashed potatoes', NULL, 0, NULL),
  ('us-thanksgiving', 4, 'Gravy', NULL, 0, NULL),
  ('us-thanksgiving', 5, 'Cranberry sauce', NULL, 0, NULL),
  ('us-thanksgiving', 6, 'Green bean casserole', '["Green beans"]', 0, NULL),
  ('us-thanksgiving', 7, 'Sweet potato casserole', '["Sweet potatoes"]', 0, NULL),
  ('us-thanksgiving', 8, 'Pumpkin pie', NULL, 0, NULL),
  ('us-thanksgiving', 9, 'Pecan pie', NULL, 0, NULL),
  ('us-thanksgiving', 10, 'Cornbread', NULL, 0, NULL),
  ('us-thanksgiving', 11, 'Dinner rolls', '["Rolls"]', 0, NULL),
  ('us-thanksgiving', 12, 'Brussels sprouts', NULL, 0, NULL),
  ('us-thanksgiving', 13, 'Mac and cheese', NULL, 0, NULL),
  ('us-thanksgiving', 14, 'Candied yams', '["Yams"]', 0, NULL),
  ('us-thanksgiving', 15, 'Deviled eggs', NULL, 0, NULL),
  ('us-thanksgiving', 16, 'Apple pie', NULL, 0, NULL),
  ('us-thanksgiving', 17, 'Creamed corn', NULL, 0, NULL),
  ('us-thanksgiving', 18, 'Giblet gravy', '["Giblets"]', 0, NULL);

-- ── Name 10 American snack brands
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-snack-brands', 'food', 'Name 10 American snack brands', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-snack-brands', 1, 'Doritos', NULL, 0, NULL),
  ('us-snack-brands', 2, 'Lay''s', '["Lays"]', 0, NULL),
  ('us-snack-brands', 3, 'Cheetos', NULL, 0, NULL),
  ('us-snack-brands', 4, 'Fritos', NULL, 0, NULL),
  ('us-snack-brands', 5, 'Pringles', NULL, 0, NULL),
  ('us-snack-brands', 6, 'Ruffles', NULL, 0, NULL),
  ('us-snack-brands', 7, 'Tostitos', NULL, 0, NULL),
  ('us-snack-brands', 8, 'Sun Chips', NULL, 0, NULL),
  ('us-snack-brands', 9, 'Goldfish', NULL, 0, NULL),
  ('us-snack-brands', 10, 'Oreo', NULL, 0, NULL),
  ('us-snack-brands', 11, 'Chips Ahoy', NULL, 0, NULL),
  ('us-snack-brands', 12, 'Nutter Butter', NULL, 0, NULL),
  ('us-snack-brands', 13, 'Cheez-It', '["Cheez It"]', 0, NULL),
  ('us-snack-brands', 14, 'Twinkies', NULL, 0, NULL),
  ('us-snack-brands', 15, 'Pop-Tarts', '["Pop Tarts"]', 0, NULL),
  ('us-snack-brands', 16, 'Ritz', NULL, 0, NULL),
  ('us-snack-brands', 17, 'Triscuit', NULL, 0, NULL),
  ('us-snack-brands', 18, 'Funyuns', NULL, 0, NULL),
  ('us-snack-brands', 19, 'Takis', NULL, 0, NULL),
  ('us-snack-brands', 20, 'Slim Jim', NULL, 0, NULL);

-- ── Name 10 American breakfast cereals
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-cereal-brands', 'food', 'Name 10 American breakfast cereals', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-cereal-brands', 1, 'Cheerios', NULL, 0, NULL),
  ('us-cereal-brands', 2, 'Frosted Flakes', NULL, 0, NULL),
  ('us-cereal-brands', 3, 'Lucky Charms', NULL, 0, NULL),
  ('us-cereal-brands', 4, 'Froot Loops', '["Fruit Loops"]', 0, NULL),
  ('us-cereal-brands', 5, 'Cinnamon Toast Crunch', NULL, 0, NULL),
  ('us-cereal-brands', 6, 'Cocoa Puffs', NULL, 0, NULL),
  ('us-cereal-brands', 7, 'Rice Krispies', NULL, 0, NULL),
  ('us-cereal-brands', 8, 'Corn Flakes', NULL, 0, NULL),
  ('us-cereal-brands', 9, 'Raisin Bran', NULL, 0, NULL),
  ('us-cereal-brands', 10, 'Special K', NULL, 0, NULL),
  ('us-cereal-brands', 11, 'Wheaties', NULL, 0, NULL),
  ('us-cereal-brands', 12, 'Trix', NULL, 0, NULL),
  ('us-cereal-brands', 13, 'Apple Jacks', NULL, 0, NULL),
  ('us-cereal-brands', 14, 'Honeycomb', NULL, 0, NULL),
  ('us-cereal-brands', 15, 'Kix', NULL, 0, NULL),
  ('us-cereal-brands', 16, 'Grape-Nuts', '["Grape Nuts"]', 0, NULL),
  ('us-cereal-brands', 17, 'Cap''n Crunch', '["Captain Crunch"]', 0, NULL),
  ('us-cereal-brands', 18, 'Golden Grahams', NULL, 0, NULL);

-- ── Name 10 US states on the Atlantic coast
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-states-atlantic-coast', 'states', 'Name 10 US states on the Atlantic coast', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-states-atlantic-coast', 1, 'Maine', NULL, 0, NULL),
  ('us-states-atlantic-coast', 2, 'New Hampshire', NULL, 0, NULL),
  ('us-states-atlantic-coast', 3, 'Massachusetts', NULL, 0, NULL),
  ('us-states-atlantic-coast', 4, 'Rhode Island', NULL, 0, NULL),
  ('us-states-atlantic-coast', 5, 'Connecticut', NULL, 0, NULL),
  ('us-states-atlantic-coast', 6, 'New York', NULL, 0, NULL),
  ('us-states-atlantic-coast', 7, 'New Jersey', NULL, 0, NULL),
  ('us-states-atlantic-coast', 8, 'Delaware', NULL, 0, NULL),
  ('us-states-atlantic-coast', 9, 'Maryland', NULL, 0, NULL),
  ('us-states-atlantic-coast', 10, 'Virginia', NULL, 0, NULL),
  ('us-states-atlantic-coast', 11, 'North Carolina', NULL, 0, NULL),
  ('us-states-atlantic-coast', 12, 'South Carolina', NULL, 0, NULL),
  ('us-states-atlantic-coast', 13, 'Georgia', NULL, 0, NULL),
  ('us-states-atlantic-coast', 14, 'Florida', NULL, 0, NULL);

-- ── Name 10 American landmarks
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-landmarks', 'places', 'Name 10 American landmarks', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-landmarks', 1, 'Statue of Liberty', NULL, 0, NULL),
  ('us-landmarks', 2, 'Golden Gate Bridge', NULL, 0, NULL),
  ('us-landmarks', 3, 'Mount Rushmore', NULL, 0, NULL),
  ('us-landmarks', 4, 'Grand Canyon', NULL, 0, NULL),
  ('us-landmarks', 5, 'White House', NULL, 0, NULL),
  ('us-landmarks', 6, 'Empire State Building', NULL, 0, NULL),
  ('us-landmarks', 7, 'Hollywood Sign', NULL, 0, NULL),
  ('us-landmarks', 8, 'Lincoln Memorial', NULL, 0, NULL),
  ('us-landmarks', 9, 'Times Square', NULL, 0, NULL),
  ('us-landmarks', 10, 'Alcatraz', NULL, 0, NULL),
  ('us-landmarks', 11, 'Niagara Falls', NULL, 0, NULL),
  ('us-landmarks', 12, 'Space Needle', NULL, 0, NULL),
  ('us-landmarks', 13, 'Gateway Arch', NULL, 0, NULL),
  ('us-landmarks', 14, 'Liberty Bell', NULL, 0, NULL),
  ('us-landmarks', 15, 'Washington Monument', NULL, 0, NULL),
  ('us-landmarks', 16, 'Brooklyn Bridge', NULL, 0, NULL),
  ('us-landmarks', 17, 'Willis Tower', '["Sears Tower"]', 0, NULL),
  ('us-landmarks', 18, 'Las Vegas Strip', NULL, 0, NULL),
  ('us-landmarks', 19, 'Mount Vernon', NULL, 0, NULL),
  ('us-landmarks', 20, 'Pearl Harbor', NULL, 0, NULL);

-- ── Name 10 US national parks
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-national-parks', 'places', 'Name 10 US national parks', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-national-parks', 1, 'Yellowstone', NULL, 0, NULL),
  ('us-national-parks', 2, 'Yosemite', NULL, 0, NULL),
  ('us-national-parks', 3, 'Grand Canyon', NULL, 0, NULL),
  ('us-national-parks', 4, 'Zion', NULL, 0, NULL),
  ('us-national-parks', 5, 'Acadia', NULL, 0, NULL),
  ('us-national-parks', 6, 'Arches', NULL, 0, NULL),
  ('us-national-parks', 7, 'Bryce Canyon', NULL, 0, NULL),
  ('us-national-parks', 8, 'Glacier', NULL, 0, NULL),
  ('us-national-parks', 9, 'Great Smoky Mountains', '["Smoky Mountains"]', 0, NULL),
  ('us-national-parks', 10, 'Joshua Tree', NULL, 0, NULL),
  ('us-national-parks', 11, 'Olympic', NULL, 0, NULL),
  ('us-national-parks', 12, 'Rocky Mountain', NULL, 0, NULL),
  ('us-national-parks', 13, 'Sequoia', NULL, 0, NULL),
  ('us-national-parks', 14, 'Death Valley', NULL, 0, NULL),
  ('us-national-parks', 15, 'Everglades', NULL, 0, NULL),
  ('us-national-parks', 16, 'Denali', NULL, 0, NULL),
  ('us-national-parks', 17, 'Shenandoah', NULL, 0, NULL),
  ('us-national-parks', 18, 'Badlands', NULL, 0, NULL),
  ('us-national-parks', 19, 'Grand Teton', NULL, 0, NULL),
  ('us-national-parks', 20, 'Redwood', NULL, 0, NULL);

-- ── Name 10 US state nicknames
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-state-nicknames', 'states', 'Name 10 US state nicknames', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-state-nicknames', 1, 'The Sunshine State', '["Sunshine State"]', 0, NULL),
  ('us-state-nicknames', 2, 'The Golden State', '["Golden State"]', 0, NULL),
  ('us-state-nicknames', 3, 'The Lone Star State', '["Lone Star State"]', 0, NULL),
  ('us-state-nicknames', 4, 'The Empire State', '["Empire State"]', 0, NULL),
  ('us-state-nicknames', 5, 'The Garden State', '["Garden State"]', 0, NULL),
  ('us-state-nicknames', 6, 'The Peach State', '["Peach State"]', 0, NULL),
  ('us-state-nicknames', 7, 'The Aloha State', '["Aloha State"]', 0, NULL),
  ('us-state-nicknames', 8, 'The Last Frontier', '["Last Frontier"]', 0, NULL),
  ('us-state-nicknames', 9, 'The Grand Canyon State', '["Grand Canyon State"]', 0, NULL),
  ('us-state-nicknames', 10, 'The Show-Me State', '["Show Me State"]', 0, NULL),
  ('us-state-nicknames', 11, 'The Buckeye State', '["Buckeye State"]', 0, NULL),
  ('us-state-nicknames', 12, 'The Hoosier State', '["Hoosier State"]', 0, NULL),
  ('us-state-nicknames', 13, 'The Bluegrass State', '["Bluegrass State"]', 0, NULL),
  ('us-state-nicknames', 14, 'The Pelican State', '["Pelican State"]', 0, NULL),
  ('us-state-nicknames', 15, 'The Beehive State', '["Beehive State"]', 0, NULL),
  ('us-state-nicknames', 16, 'The Evergreen State', '["Evergreen State"]', 0, NULL),
  ('us-state-nicknames', 17, 'The Keystone State', '["Keystone State"]', 0, NULL),
  ('us-state-nicknames', 18, 'The Old Dominion', '["Old Dominion"]', 0, NULL);

-- ── Name 10 American city nicknames
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-city-nicknames', 'cities', 'Name 10 American city nicknames', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-city-nicknames', 1, 'The Big Apple', '["Big Apple"]', 0, NULL),
  ('us-city-nicknames', 2, 'The Windy City', '["Windy City"]', 0, NULL),
  ('us-city-nicknames', 3, 'The Big Easy', '["Big Easy"]', 0, NULL),
  ('us-city-nicknames', 4, 'Motor City', NULL, 0, NULL),
  ('us-city-nicknames', 5, 'Sin City', NULL, 0, NULL),
  ('us-city-nicknames', 6, 'The City of Angels', '["City of Angels"]', 0, NULL),
  ('us-city-nicknames', 7, 'Beantown', NULL, 0, NULL),
  ('us-city-nicknames', 8, 'The Mile High City', '["Mile High City"]', 0, NULL),
  ('us-city-nicknames', 9, 'Music City', NULL, 0, NULL),
  ('us-city-nicknames', 10, 'The Emerald City', '["Emerald City"]', 0, NULL),
  ('us-city-nicknames', 11, 'Steel City', NULL, 0, NULL),
  ('us-city-nicknames', 12, 'Space City', NULL, 0, NULL),
  ('us-city-nicknames', 13, 'The Twin Cities', '["Twin Cities"]', 0, NULL),
  ('us-city-nicknames', 14, 'Charm City', NULL, 0, NULL),
  ('us-city-nicknames', 15, 'The City of Brotherly Love', '["City of Brotherly Love"]', 0, NULL),
  ('us-city-nicknames', 16, 'Bean Town', '["The Hub"]', 0, NULL);

-- ── Name 10 people who appear on US money
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-faces-on-money', 'history', 'Name 10 people who appear on US money', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-faces-on-money', 1, 'George Washington', '["Washington"]', 0, NULL),
  ('us-faces-on-money', 2, 'Abraham Lincoln', '["Lincoln"]', 0, NULL),
  ('us-faces-on-money', 3, 'Thomas Jefferson', '["Jefferson"]', 0, NULL),
  ('us-faces-on-money', 4, 'Alexander Hamilton', '["Hamilton"]', 0, NULL),
  ('us-faces-on-money', 5, 'Andrew Jackson', '["Jackson"]', 0, NULL),
  ('us-faces-on-money', 6, 'Ulysses S. Grant', '["Grant"]', 0, NULL),
  ('us-faces-on-money', 7, 'Benjamin Franklin', '["Franklin"]', 0, NULL),
  ('us-faces-on-money', 8, 'Franklin D. Roosevelt', '["Roosevelt"]', 0, NULL),
  ('us-faces-on-money', 9, 'John F. Kennedy', '["Kennedy"]', 0, NULL),
  ('us-faces-on-money', 10, 'Dwight D. Eisenhower', '["Eisenhower"]', 0, NULL),
  ('us-faces-on-money', 11, 'Sacagawea', NULL, 0, NULL),
  ('us-faces-on-money', 12, 'Susan B. Anthony', '["Susan B Anthony"]', 0, NULL),
  ('us-faces-on-money', 13, 'James Madison', '["Madison"]', 0, NULL),
  ('us-faces-on-money', 14, 'Grover Cleveland', '["Cleveland"]', 0, NULL),
  ('us-faces-on-money', 15, 'William McKinley', '["McKinley"]', 0, NULL),
  ('us-faces-on-money', 16, 'Salmon P. Chase', '["Chase"]', 0, NULL),
  ('us-faces-on-money', 17, 'Woodrow Wilson', '["Wilson"]', 0, NULL),
  ('us-faces-on-money', 18, 'John Adams', '["Adams"]', 0, NULL);

-- ── Name 10 NFL teams
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('nfl-teams', 'sport', 'Name 10 NFL teams', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('nfl-teams', 1, 'Dallas Cowboys', '["Cowboys"]', 0, NULL),
  ('nfl-teams', 2, 'Green Bay Packers', '["Packers"]', 0, NULL),
  ('nfl-teams', 3, 'New England Patriots', '["Patriots"]', 0, NULL),
  ('nfl-teams', 4, 'Pittsburgh Steelers', '["Steelers"]', 0, NULL),
  ('nfl-teams', 5, 'Kansas City Chiefs', '["Chiefs"]', 0, NULL),
  ('nfl-teams', 6, 'San Francisco 49ers', '["49ers"]', 0, NULL),
  ('nfl-teams', 7, 'Philadelphia Eagles', '["Eagles"]', 0, NULL),
  ('nfl-teams', 8, 'New York Giants', '["Giants"]', 0, NULL),
  ('nfl-teams', 9, 'New York Jets', '["Jets"]', 0, NULL),
  ('nfl-teams', 10, 'Chicago Bears', '["Bears"]', 0, NULL),
  ('nfl-teams', 11, 'Detroit Lions', '["Lions"]', 0, NULL),
  ('nfl-teams', 12, 'Miami Dolphins', '["Dolphins"]', 0, NULL),
  ('nfl-teams', 13, 'Buffalo Bills', '["Bills"]', 0, NULL),
  ('nfl-teams', 14, 'Seattle Seahawks', '["Seahawks"]', 0, NULL),
  ('nfl-teams', 15, 'Denver Broncos', '["Broncos"]', 0, NULL),
  ('nfl-teams', 16, 'Las Vegas Raiders', '["Raiders"]', 0, NULL),
  ('nfl-teams', 17, 'Baltimore Ravens', '["Ravens"]', 0, NULL),
  ('nfl-teams', 18, 'Cleveland Browns', '["Browns"]', 0, NULL),
  ('nfl-teams', 19, 'Minnesota Vikings', '["Vikings"]', 0, NULL),
  ('nfl-teams', 20, 'Tampa Bay Buccaneers', '["Buccaneers"]', 0, NULL),
  ('nfl-teams', 21, 'Jacksonville Jaguars', '["Jaguars"]', 0, NULL),
  ('nfl-teams', 22, 'Arizona Cardinals', '["Cardinals"]', 0, NULL),
  ('nfl-teams', 23, 'New Orleans Saints', '["Saints"]', 0, NULL),
  ('nfl-teams', 24, 'Houston Texans', '["Texans"]', 0, NULL);

-- ── Name 10 NBA teams
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('nba-teams', 'sport', 'Name 10 NBA teams', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('nba-teams', 1, 'Los Angeles Lakers', '["Lakers"]', 0, NULL),
  ('nba-teams', 2, 'Boston Celtics', '["Celtics"]', 0, NULL),
  ('nba-teams', 3, 'Chicago Bulls', '["Bulls"]', 0, NULL),
  ('nba-teams', 4, 'Golden State Warriors', '["Warriors"]', 0, NULL),
  ('nba-teams', 5, 'Miami Heat', '["Heat"]', 0, NULL),
  ('nba-teams', 6, 'New York Knicks', '["Knicks"]', 0, NULL),
  ('nba-teams', 7, 'Brooklyn Nets', '["Nets"]', 0, NULL),
  ('nba-teams', 8, 'Philadelphia 76ers', '["76ers"]', 0, NULL),
  ('nba-teams', 9, 'Toronto Raptors', '["Raptors"]', 0, NULL),
  ('nba-teams', 10, 'Milwaukee Bucks', '["Bucks"]', 0, NULL),
  ('nba-teams', 11, 'Denver Nuggets', '["Nuggets"]', 0, NULL),
  ('nba-teams', 12, 'Phoenix Suns', '["Suns"]', 0, NULL),
  ('nba-teams', 13, 'Dallas Mavericks', '["Mavericks"]', 0, NULL),
  ('nba-teams', 14, 'San Antonio Spurs', '["Spurs"]', 0, NULL),
  ('nba-teams', 15, 'Houston Rockets', '["Rockets"]', 0, NULL),
  ('nba-teams', 16, 'Utah Jazz', '["Jazz"]', 0, NULL),
  ('nba-teams', 17, 'Portland Trail Blazers', '["Trail Blazers"]', 0, NULL),
  ('nba-teams', 18, 'Sacramento Kings', '["Kings"]', 0, NULL),
  ('nba-teams', 19, 'Oklahoma City Thunder', '["Thunder"]', 0, NULL),
  ('nba-teams', 20, 'Memphis Grizzlies', '["Grizzlies"]', 0, NULL),
  ('nba-teams', 21, 'Atlanta Hawks', '["Hawks"]', 0, NULL),
  ('nba-teams', 22, 'Orlando Magic', '["Magic"]', 0, NULL),
  ('nba-teams', 23, 'Indiana Pacers', '["Pacers"]', 0, NULL),
  ('nba-teams', 24, 'Detroit Pistons', '["Pistons"]', 0, NULL);

-- ── Name 10 things you only really see in America
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-only-things', 'life', 'Name 10 things you only really see in America', 0, NULL);
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-only-things', 1, 'Drive-thru everything', '["Drive thru"]', 0, NULL),
  ('us-only-things', 2, 'Red Solo cups', '["Solo cups"]', 0, NULL),
  ('us-only-things', 3, 'Yellow school buses', '["School buses"]', 0, NULL),
  ('us-only-things', 4, 'Free refills', NULL, 0, NULL),
  ('us-only-things', 5, 'Root beer', NULL, 0, NULL),
  ('us-only-things', 6, 'Tipping everywhere', '["Tipping"]', 0, NULL),
  ('us-only-things', 7, 'Black Friday', NULL, 0, NULL),
  ('us-only-things', 8, 'Varsity jackets', '["Letterman jackets"]', 0, NULL),
  ('us-only-things', 9, 'Mailboxes on posts', '["Mailboxes"]', 0, NULL),
  ('us-only-things', 10, 'Drugstores', NULL, 0, NULL),
  ('us-only-things', 11, 'Prom', NULL, 0, NULL),
  ('us-only-things', 12, 'Pledge of Allegiance', NULL, 0, NULL),
  ('us-only-things', 13, 'Cheerleaders', NULL, 0, NULL),
  ('us-only-things', 14, 'Giant fridges', NULL, 0, NULL),
  ('us-only-things', 15, 'Screen doors', NULL, 0, NULL),
  ('us-only-things', 16, 'Flags on houses', '["Flags everywhere"]', 0, NULL),
  ('us-only-things', 17, 'Pharmacy adverts', '["Drug adverts"]', 0, NULL),
  ('us-only-things', 18, 'Bottomless coffee', NULL, 0, NULL);

-- ── The 10 smallest US states by area
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-states-smallest', 'states', 'The 10 smallest US states by area', 1, 'area');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-states-smallest', 1, 'Rhode Island', NULL, 4001, '4,001 sq mi'),
  ('us-states-smallest', 2, 'Delaware', NULL, 2489, '2,489 sq mi'),
  ('us-states-smallest', 3, 'Connecticut', NULL, 5543, '5,543 sq mi'),
  ('us-states-smallest', 4, 'New Jersey', NULL, 8723, '8,723 sq mi'),
  ('us-states-smallest', 5, 'New Hampshire', NULL, 9349, '9,349 sq mi'),
  ('us-states-smallest', 6, 'Vermont', NULL, 9616, '9,616 sq mi'),
  ('us-states-smallest', 7, 'Massachusetts', NULL, 10554, '10,554 sq mi'),
  ('us-states-smallest', 8, 'Hawaii', NULL, 10932, '10,932 sq mi'),
  ('us-states-smallest', 9, 'Maryland', NULL, 12406, '12,406 sq mi'),
  ('us-states-smallest', 10, 'West Virginia', NULL, 24230, '24,230 sq mi');

-- ── The first 10 states to join the Union
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-first-states', 'history', 'The first 10 states to join the Union', 1, 'year');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-first-states', 1, 'Delaware', NULL, 1787, '1787'),
  ('us-first-states', 2, 'Pennsylvania', NULL, 1787, '1787'),
  ('us-first-states', 3, 'New Jersey', NULL, 1787, '1787'),
  ('us-first-states', 4, 'Georgia', NULL, 1788, '1788'),
  ('us-first-states', 5, 'Connecticut', NULL, 1788, '1788'),
  ('us-first-states', 6, 'Massachusetts', NULL, 1788, '1788'),
  ('us-first-states', 7, 'Maryland', NULL, 1788, '1788'),
  ('us-first-states', 8, 'South Carolina', NULL, 1788, '1788'),
  ('us-first-states', 9, 'New Hampshire', NULL, 1788, '1788'),
  ('us-first-states', 10, 'Virginia', NULL, 1788, '1788');

-- ── The 10 longest rivers in the US
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-rivers-longest', 'rivers', 'The 10 longest rivers in the US', 1, 'km');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-rivers-longest', 1, 'Missouri', NULL, 3767, '3,767km'),
  ('us-rivers-longest', 2, 'Mississippi', NULL, 3766, '3,766km'),
  ('us-rivers-longest', 3, 'Yukon', NULL, 3185, '3,185km'),
  ('us-rivers-longest', 4, 'Rio Grande', NULL, 3057, '3,057km'),
  ('us-rivers-longest', 5, 'Colorado', NULL, 2334, '2,334km'),
  ('us-rivers-longest', 6, 'Arkansas', NULL, 2348, '2,348km'),
  ('us-rivers-longest', 7, 'Columbia', NULL, 2000, '2,000km'),
  ('us-rivers-longest', 8, 'Red River', '["Red"]', 1960, '1,960km'),
  ('us-rivers-longest', 9, 'Snake', NULL, 1735, '1,735km'),
  ('us-rivers-longest', 10, 'Ohio', NULL, 1579, '1,579km');

-- ── The 10 busiest airports in the US
INSERT OR IGNORE INTO general_rounds (slug, topic, title, ordered, unit)
VALUES ('us-busiest-airports', 'transport', 'The 10 busiest airports in the US', 1, 'passengers');
INSERT OR IGNORE INTO general_answers (round_slug, position, name, aliases, value, display) VALUES
  ('us-busiest-airports', 1, 'Atlanta', '["Hartsfield Jackson"]', 104000000, '104m'),
  ('us-busiest-airports', 2, 'Dallas Fort Worth', '["Dallas"]', 81000000, '81m'),
  ('us-busiest-airports', 3, 'Denver', NULL, 77000000, '77m'),
  ('us-busiest-airports', 4, 'Chicago O''Hare', '["OHare", "Chicago"]', 75000000, '75m'),
  ('us-busiest-airports', 5, 'Los Angeles', '["LAX"]', 75000000, '75m'),
  ('us-busiest-airports', 6, 'Charlotte', NULL, 58000000, '58m'),
  ('us-busiest-airports', 7, 'Orlando', NULL, 57000000, '57m'),
  ('us-busiest-airports', 8, 'Las Vegas', NULL, 57000000, '57m'),
  ('us-busiest-airports', 9, 'Phoenix', '["Sky Harbor"]', 52000000, '52m'),
  ('us-busiest-airports', 10, 'Miami', NULL, 52000000, '52m');

INSERT OR IGNORE INTO tenable_rounds (category, type, params, metric, title, answer_count)
SELECT 'general', 'general', '{"round":"' || r.slug || '"}', 'none', r.title,
       (SELECT COUNT(*) FROM general_answers a WHERE a.round_slug = r.slug)
FROM general_rounds r;
