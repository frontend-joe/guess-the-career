-- Per-user global settings (JSON blob). First setting: guessPercentage (the share
-- of a round's players a user must guess to pass). Stored as a small JSON object so
-- more settings can be added without further migrations.
ALTER TABLE users ADD COLUMN settings TEXT NOT NULL DEFAULT '{}';
