-- A name to put on a video tile.
--
-- Users have only had an email until now, which is fine for a solo web game
-- where nobody sees anyone else. Multiplayer rooms show four people to each
-- other and label four tiles in a recorded video, so every user needs a short
-- human name.
--
-- Backfilled from the email local-part so no existing user is ever nameless.
-- Deliberately NOT unique: this is a label shown among friends, not an
-- identity, and two Joes in one room is their problem, not the schema's.
--
-- No index over normalize(display_name): the normalize() function registered in
-- db/client.ts is not declared deterministic, and an index expression over it
-- would make the database file unopenable by any other process — including the
-- sqlite3 CLI this project is administered with.
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

UPDATE users
SET display_name = substr(email, 1, instr(email, '@') - 1)
WHERE display_name IS NULL AND instr(email, '@') > 1;
