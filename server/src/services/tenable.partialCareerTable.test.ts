import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A career table that covers only part of a career used to be worse than no
// career table at all.
//
// The stint fallback was gated per PLAYER: one career-statistics row anywhere
// switched off every stint that player had. Dalian Atkinson's scraped table
// begins at Real Sociedad in 1990, so his four years at Ipswich and his
// season at Sheffield Wednesday — both sitting in career_stints with real
// apps and goals — counted for nothing, and he was on neither club's board.
// Gate it per CLUB and the spells the table does not reach come back.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'partial-career-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { answersForRound } = await import('./tenable.ts')

function club(name: string, url: string) {
  sqlite.prepare('INSERT INTO clubs (name, wikipedia_url) VALUES (?, ?)').run(name, url)
}

function footballer(name: string): number {
  return (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality, position)
       VALUES (?, ?, ?, 'England', 'Striker') RETURNING id`,
    )
    .get(name, name.split(' ').at(-1), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as {
    id: number
  }).id
}

function season(fid: number, club: string, league: string, apps: number, goals: number) {
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, total_apps, total_goals)
       VALUES (?, ?, ?, ?, '1990-91', ?, ?)`,
    )
    .run(fid, club, league, league, apps, goals)
}

let order = 0
function stint(fid: number, club: string, years: string, apps: number, goals: number) {
  sqlite
    .prepare(
      `INSERT INTO career_stints (footballer_id, club, years, apps, goals, stint_type, sort_order)
       VALUES (?, ?, ?, ?, ?, 'senior', ?)`,
    )
    .run(fid, club, years, apps, goals, order++)
}

club('Sheffield Wednesday', 'https://en.wikipedia.org/wiki/Sheffield_Wednesday_F.C.')
club('Real Sociedad', 'https://en.wikipedia.org/wiki/Real_Sociedad')

// Enough scraped players to make Sheffield Wednesday a club the rounds know
// about — the allow-list is built from career_statistics, not from stints.
for (let i = 0; i < 10; i++) {
  season(footballer(`Owl ${i}`), 'Sheffield Wednesday', 'Premier League', 20 + i, 2 + i)
}

// His table starts in Spain. The two English spells exist only as stints.
const atkinson = footballer('Dalian Atkinson')
season(atkinson, 'Real Sociedad', 'La Liga', 32, 12)
stint(atkinson, 'Sheffield Wednesday', '1989–1990', 38, 10)
stint(atkinson, 'Real Sociedad', '1990–1991', 29, 12)

test('a spell the career table never reached still counts', () => {
  const answers = answersForRound('club', { club: 'Sheffield Wednesday' }, 'goals')
  const him = answers.find((a) => a.footballer_id === atkinson)
  assert.ok(him, 'Sheffield Wednesday strikers without their 1989-90 striker is not the board')
  assert.equal(him.value, 10, 'straight off the stint, which is the only record of the season')
})

test('a club the career table does cover is not counted twice', () => {
  // Both sources know about Real Sociedad. The table wins outright: it is per
  // season and per competition, where the stint is one rounded infobox total.
  const answers = answersForRound('club', { club: 'Real Sociedad' }, 'goals')
  const him = answers.find((a) => a.footballer_id === atkinson)
  assert.ok(him)
  assert.equal(him.value, 12, '12, not 24')
})
