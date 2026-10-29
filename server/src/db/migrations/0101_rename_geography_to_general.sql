-- Geography becomes General.
--
-- The category was named after the first subject anybody wrote rounds for, and
-- the rounds coming next are not all geography. Nothing about the category was
-- ever geographical — it is simply "rounds whose answers are authored rather
-- than derived", which is a statement about where answers come from and not
-- about what they are of. Topics already carry the subject.
--
-- A rename rather than a second category, because a second one would split the
-- same ten-slot board across two admin screens and two picker tabs for no
-- reason anybody could explain while using it.
--
-- The data is live by the time this runs, so the rows have to move with the
-- name: there are rounds in production already, and possibly a frozen instance
-- of one in a room that has not finished.
ALTER TABLE geography_rounds RENAME TO general_rounds;
ALTER TABLE geography_answers RENAME TO general_answers;

UPDATE tenable_rounds SET category = 'general', type = 'general' WHERE category = 'geography';
UPDATE game_round_instances SET type = 'general' WHERE type = 'geography';

-- The indexes were named after the old tables. SQLite carries them across a
-- rename, so they still work — they are just called the wrong thing, and the
-- next person to read the schema would believe a table existed that does not.
DROP INDEX IF EXISTS idx_geography_rounds_topic;
DROP INDEX IF EXISTS idx_geography_answers_round;
CREATE INDEX IF NOT EXISTS idx_general_rounds_topic ON general_rounds(topic);
CREATE INDEX IF NOT EXISTS idx_general_answers_round ON general_answers(round_slug, position);
