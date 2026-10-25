-- Football Tenable: 10-answer list rounds (inverted pyramid gameplay).
--
-- Rounds are DERIVED from career_statistics + footballers rather than stored as
-- answer lists, so they stay correct as the data improves. We only persist the
-- rounds an admin has chosen (type + params + metric), plus the schedule.
CREATE TABLE IF NOT EXISTS tenable_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,            -- question type slug (e.g. 'surname-initial')
  params TEXT NOT NULL,          -- JSON params for the type (league, letter, ...)
  metric TEXT NOT NULL,          -- 'goals' | 'apps'
  title TEXT NOT NULL,           -- rendered question, snapshotted for the admin list
  answer_count INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, params, metric)
);

CREATE TABLE IF NOT EXISTS tenable_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  round_id INTEGER REFERENCES tenable_rounds(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenable_rounds_type ON tenable_rounds(type);
CREATE INDEX IF NOT EXISTS idx_tenable_rounds_enabled ON tenable_rounds(enabled);
