import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ALLOWED_LEAGUES, CLUB_SEASON_LEAGUE } from './tenable.ts'

// The infobox fallback decides whether a player appears in a league round at
// all, and when it gets the answer wrong the round simply does not contain
// them — no error, nothing in a log, just a name a player swears should be
// there. Dirk Kuyt went missing from "Most Premier League goals by Netherlands
// players" exactly that way, so the rule gets a test of its own.
//
// This builds the two CTEs against a throwaway database rather than importing
// the query, because what is being pinned is the SQL's behaviour on a shape of
// data — every season scraped, not one of them carrying a division.

const LEAGUES = ALLOWED_LEAGUES.map((l) => `'${l}'`).join(', ')

/// The predicate under test, as tenable.ts spells it: a scraped row only
/// displaces the infobox when it carries a league we build rounds from.
const STINT_RESOLVED = `
  WITH csl AS (${CLUB_SEASON_LEAGUE}),
  spell AS (
    SELECT st.id AS sid, st.footballer_id AS fid,
           REPLACE(REPLACE(st.club, '→ ', ''), ' (loan)', '') AS club,
           CAST(SUBSTR(st.years, 1, 4) AS INTEGER) AS y1,
           CAST(SUBSTR(st.years, -4) AS INTEGER) AS y2,
           COALESCE(st.apps, 0) AS apps, COALESCE(st.goals, 0) AS goals
    FROM career_stints st
    WHERE st.stint_type = 'senior'
      AND NOT EXISTS (
        SELECT 1 FROM career_statistics x
        WHERE x.footballer_id = st.footballer_id
          AND COALESCE(x.league, x.division) IN (${LEAGUES})
      )
  ),
  per_league AS (
    SELECT sp.sid, sp.fid, sp.club, sp.apps, sp.goals, cs.league AS league, COUNT(*) AS seasons
    FROM spell sp
    JOIN csl cs ON cs.club = sp.club AND cs.yr BETWEEN sp.y1 AND MAX(sp.y2 - 1, sp.y1)
    GROUP BY sp.sid, cs.league
  ),
  spell_total AS (SELECT sid, SUM(seasons) AS seasons FROM per_league GROUP BY sid)
  SELECT pl.fid AS fid, pl.league AS league,
         CAST(ROUND(pl.goals * 1.0 * pl.seasons / st.seasons) AS INTEGER) AS goals
  FROM per_league pl JOIN spell_total st ON st.sid = pl.sid
  WHERE pl.league IN (${LEAGUES})
`

function freshDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE career_stints (
      id INTEGER PRIMARY KEY, footballer_id INTEGER, club TEXT, years TEXT,
      apps INTEGER, goals INTEGER, stint_type TEXT
    );
    CREATE TABLE career_statistics (
      id INTEGER PRIMARY KEY, footballer_id INTEGER, club TEXT, season TEXT,
      division TEXT, league TEXT, league_apps INTEGER, league_goals INTEGER
    );
    CREATE TABLE club_seasons (club TEXT, season_year INTEGER, league TEXT);
  `)
  // Liverpool were in the Premier League for every year of the spell below.
  for (let yr = 2006; yr <= 2011; yr++) {
    db.prepare(`INSERT INTO club_seasons VALUES ('Liverpool', ?, 'Premier League')`).run(yr)
  }
  db.prepare(
    `INSERT INTO career_stints VALUES (1, 1080, 'Liverpool', '2006–2012', 208, 51, 'senior')`,
  ).run()
  return db
}

const goalsFor = (db: Database.Database, fid: number) =>
  (db.prepare(`${STINT_RESOLVED} AND pl.fid = ?`).get(fid) as { goals: number } | undefined)?.goals

test('a player with no scraped seasons falls back to the infobox', () => {
  const db = freshDb()
  assert.equal(goalsFor(db, 1080), 51)
})

test('seasons scraped without a division do not suppress the fallback', () => {
  const db = freshDb()
  // Kuyt's real shape: every Liverpool season present, none carrying a
  // division. These rows cannot answer a league question, so they must not
  // displace the infobox spell that can.
  for (const [season, goals] of [['2006–07', 12], ['2007–08', 3], ['2008–09', 12],
                                 ['2009–10', 9], ['2010–11', 13], ['2011–12', 2]] as const) {
    db.prepare(
      `INSERT INTO career_statistics (footballer_id, club, season, division, league, league_apps, league_goals)
       VALUES (1080, 'Liverpool', ?, NULL, NULL, 34, ?)`,
    ).run(season, goals)
  }
  assert.equal(goalsFor(db, 1080), 51)
})

test('a season scraped WITH an allowed league suppresses the fallback', () => {
  const db = freshDb()
  // Now the scraped rows can answer the question, so they own it — counting
  // the infobox too would double the player's goals.
  db.prepare(
    `INSERT INTO career_statistics (footballer_id, club, season, division, league, league_apps, league_goals)
     VALUES (1080, 'Liverpool', '2006–07', 'Premier League', 'Premier League', 34, 12)`,
  ).run()
  assert.equal(goalsFor(db, 1080), undefined)
})
