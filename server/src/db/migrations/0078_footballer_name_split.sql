-- Split footballer names into first name + surname so surname-based games
-- ("players whose surname begins with M") are correct by default.
--
-- Handles particle surnames (Del Piero, Di Matteo, van der Vaart, Le Tissier)
-- and East-Asian name order (Kim Min-jae -> Kim). Anything genuinely debatable
-- is flagged `name_ambiguous` for review in the admin; once an admin saves a
-- split, `name_confirmed` pins it and automatic recomputes leave it alone.
ALTER TABLE footballers ADD COLUMN first_name TEXT;
ALTER TABLE footballers ADD COLUMN surname TEXT;
ALTER TABLE footballers ADD COLUMN name_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE footballers ADD COLUMN name_ambiguous INTEGER NOT NULL DEFAULT 0;
ALTER TABLE footballers ADD COLUMN name_split_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_footballers_surname ON footballers(surname);
