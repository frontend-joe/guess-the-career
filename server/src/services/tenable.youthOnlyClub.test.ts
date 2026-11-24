import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A club somebody was only ever a boy at is not a club they played for.
//
// Wikipedia's career-statistics table sometimes carries an academy season.
// David Seaman has "Leeds United 1981–82" — nil in the league, one
// appearance under Other — and it put him among Leeds United's goalkeepers,
// which no room would accept. His infobox is unambiguous: Leeds is his youth
// career and his senior career starts at Peterborough.
//
// Appearances cannot tell the two cases apart, which is the whole difficulty.
// Ali Al-Habsi signed for West Bromwich Albion as a senior keeper and never
// got on — nought everywhere — and he belongs on that board.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'youthclub-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { answersForRound } = await import('./tenable.ts')

function keeper(name: string): number {
  return (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality, position)
       VALUES (?, ?, ?, 'England', 'Goalkeeper') RETURNING id`,
    )
    .get(name, name.split(' ').pop(), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as {
    id: number
  }).id
}

function stat(id: number, club: string, apps: number, total = apps): void {
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, sort_order, club, season, division, league, league_apps, league_goals, total_apps, total_goals)
       VALUES (?, 0, ?, '1981–82', 'Premier League', 'Premier League', ?, 0, ?, 0)`,
    )
    .run(id, club, apps, total)
}

function stint(id: number, club: string, type: string): void {
  sqlite
    .prepare(
      `INSERT INTO career_stints (footballer_id, sort_order, years, club, apps, goals, stint_type)
       VALUES (?, 0, '1981–1982', ?, NULL, NULL, ?)`,
    )
    .run(id, club, type)
}

// The apprentice: a statistics line for Leeds, and Leeds is youth-only.
const seaman = keeper('Test Seaman')
stat(seaman, 'Leeds United', 0, 1)
stint(seaman, 'Leeds United', 'youth')
stint(seaman, 'Peterborough United', 'senior')

// The senior signing who never got on. Nought everywhere, and still a keeper
// the club had.
const habsi = keeper('Test Al-Habsi')
stat(habsi, 'Leeds United', 0, 0)
stint(habsi, 'Leeds United', 'senior')

// Came through the academy AND played. Both sections name the club, so the
// youth row must not disqualify the senior one.
const academy = keeper('Test Academy Graduate')
stat(academy, 'Leeds United', 150)
stint(academy, 'Leeds United', 'youth')
stint(academy, 'Leeds United', 'senior')

// A real spell the two sources spell differently. Nothing about this player
// is youth, so he must be untouched — the rule keys on a youth stint, never
// on the mere absence of a matching senior one.
const spelling = keeper('Test Spelling')
stat(spelling, 'Leeds United', 90)
stint(spelling, 'Leeds Utd', 'senior')

const LEEDS = { club: 'Leeds United', position: 'goalkeeper' }
const names = () => answersForRound('club-position', LEEDS, 'apps', 200).map((a) => a.name)

test('a club somebody was only a boy at is not one of their clubs', () => {
  assert.ok(!names().includes('Test Seaman'), 'the apprentice is not one of the club keepers')
})

test('a senior keeper who never got on is still one of their keepers', () => {
  // The rule must not become "nought appearances means no".
  assert.ok(names().includes('Test Al-Habsi'))
})

test('coming through the academy and then playing still counts', () => {
  assert.ok(names().includes('Test Academy Graduate'))
})

test('a spell the two sources spell differently is left alone', () => {
  assert.ok(names().includes('Test Spelling'))
})
