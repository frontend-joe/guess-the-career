import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// "South American Arsenal players", "African Roma players". A club's Africans
// or its South Americans are a group everybody who follows it can picture and
// nobody can list, which is the whole shape of a Tenable round.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'continent-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { answersForRound, candidatesForType } = await import('./tenable.ts')
const { continentOf } = await import('./continents.ts')

function player(name: string, nationality: string, club: string, goals: number) {
  const id = (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality)
       VALUES (?, ?, ?, ?) RETURNING id`,
    )
    .get(name, name.split(' ').at(-1), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`, nationality) as { id: number }).id
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, total_apps, total_goals)
       VALUES (?, ?, 'Premier League', 'Premier League', '2020-21', 30, ?)`,
    )
    .run(id, club, goals)
  return id
}

// The league-shaped twin of player(), for the league rounds below.
function leaguePlayer(name: string, nationality: string, league: string, goals: number) {
  const id = (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality)
       VALUES (?, ?, ?, ?) RETURNING id`,
    )
    .get(name, name.split(' ').at(-1), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`, nationality) as { id: number }).id
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, league_apps, league_goals)
       VALUES (?, 'Some Club', ?, ?, '2020-21', 30, ?)`,
    )
    .run(id, league, league, goals)
  return id
}

// Eleven Africans from eight countries, so no single nationality could carry
// the board on its own — which is the reason this round exists.
const AFRICANS: [string, string][] = [
  ['Nigeria', 'Nnamdi One'], ['Nigeria', 'Chinedu Two'], ['Ghana', 'Kwame Three'],
  ['Ivory Coast', 'Yaya Four'], ['Senegal', 'Sadio Five'], ['Cameroon', 'Samuel Six'],
  ['Egypt', 'Mohamed Seven'], ['Morocco', 'Hakim Eight'], ['Mali', 'Seydou Nine'],
  ['DR Congo', 'Dieumerci Ten'], ['Zaire', 'Historic Eleven'],
]
AFRICANS.forEach(([nat, name], i) => player(name, nat, 'Arsenal', 20 - i))
// And a crowd of Europeans at the same club, who must not turn up on it.
for (let i = 0; i < 12; i++) player(`English Lad ${i}`, 'England', 'Arsenal', 40)

test('a club\'s continent is a round when enough of them played there', () => {
  const cands = candidatesForType('continent-club')
  const arsenal = cands.find((c) => c.params.club === 'Arsenal' && c.params.continent === 'africa')
  assert.ok(arsenal, 'Arsenal has an African round')
  assert.equal(arsenal.answer_count, AFRICANS.length)
  assert.equal(arsenal.title, 'African Arsenal players (most goals)')

  // Being European at a club is the default state of a footballer, not a
  // fact worth a board, however many of them there are.
  assert.equal(cands.some((c) => c.params.continent === 'europe'), false)
})

test('the answers are that continent and only that continent', () => {
  const answers = answersForRound('continent-club', { continent: 'africa', club: 'Arsenal' }, 'goals')
  assert.equal(answers.length, 10)
  assert.deepEqual(answers.map((a) => a.name).slice(0, 3), ['Nnamdi One', 'Chinedu Two', 'Kwame Three'])
  assert.equal(answers.some((a) => a.name.startsWith('English Lad')), false)
})

// A nationality is whatever the infobox said at the time, and the database
// holds states that no longer exist.
test('a country that has since been renamed is still on its continent', () => {
  assert.equal(continentOf('Zaire'), 'africa')
  assert.equal(continentOf('Yugoslavia'), 'europe')
  assert.equal(continentOf('U.S.'), 'north-america')
  assert.equal(continentOf('Atlantis'), null)
})

// A region is not a continent: they overlap it and each other. A Dane is
// European AND Scandinavian AND Nordic, and only the first of those is a
// continent — which is why continentOf keeps to the partition and isFrom
// asks the group.
test('a region overlaps the continent it sits in', async () => {
  const { isFrom } = await import('./continents.ts')

  for (const group of ['europe', 'scandinavia', 'nordic']) {
    assert.equal(isFrom(group, 'Denmark'), true, `a Dane is ${group}`)
  }
  assert.equal(continentOf('Denmark'), 'europe', 'but only one of them is their continent')

  // Scandinavia is the three, strictly. A board titled "Scandinavian" turning
  // up Jari Litmanen would be the game being wrong, not the player — so Finns
  // and Icelanders are Nordic instead.
  assert.equal(isFrom('scandinavia', 'Finland'), false)
  assert.equal(isFrom('nordic', 'Finland'), true)
  assert.equal(isFrom('nordic', 'Iceland'), true)

  // Eastern Europe takes the Cold War line, which is the one people mean.
  for (const nat of ['Russia', 'Croatia', 'Czechoslovakia', 'Yugoslavia', 'East Germany', 'Poland']) {
    assert.equal(isFrom('eastern-europe', nat), true, nat)
  }
  assert.equal(isFrom('eastern-europe', 'Austria'), false)
})

test('a club with enough Scandinavians is a round', () => {
  const NORDICS: [string, string][] = [
    ['Denmark', 'Peter Keeper'], ['Denmark', 'Michael Brother'], ['Norway', 'Ole Manager'],
    ['Sweden', 'Henrik Striker'], ['Sweden', 'Freddie Winger'], ['Norway', 'Tore Target'],
    ['Denmark', 'Jesper Flank'], ['Sweden', 'Olof Sweeper'], ['Norway', 'Erik Stopper'],
    ['Denmark', 'Thomas Anchor'],
  ]
  NORDICS.forEach(([nat, name], i) => player(name, nat, 'Boldton', 30 - i))
  // Two Finns, who are Nordic but not Scandinavian.
  player('Jari Finn', 'Finland', 'Boldton', 29)
  player('Sami Second', 'Finland', 'Boldton', 28)

  const cands = candidatesForType('continent-club')
  const scand = cands.find((c) => c.params.club === 'Boldton' && c.params.continent === 'scandinavia')
  assert.ok(scand)
  assert.equal(scand.answer_count, 10)
  assert.equal(scand.title, 'Scandinavian Boldton players (most goals)')

  const nordic = cands.find((c) => c.params.club === 'Boldton' && c.params.continent === 'nordic')
  assert.equal(nordic?.answer_count, 12, 'the Finns count here and only here')

  const answers = answersForRound('continent-club', { continent: 'scandinavia', club: 'Boldton' }, 'goals')
  assert.equal(answers.some((a) => a.name === 'Jari Finn'), false)
})

// The same question asked of a league. A league is the wider net of the two —
// a club's Scandinavians are a handful, a league's are a generation — so it is
// where the smaller regions get boards at all.
test('a league can be asked for a region too', () => {
  const EASTERN: [string, string][] = [
    ['Croatia', 'Zvonimir Winger'], ['Serbia', 'Dejan Anchor'], ['Russia', 'Igor Keeper'],
    ['Poland', 'Robert Striker'], ['Czech Republic', 'Pavel Flank'], ['Romania', 'Gheorghe Playmaker'],
    ['Bulgaria', 'Hristo Forward'], ['Ukraine', 'Andriy Target'], ['Yugoslavia', 'Dragan Historic'],
    ['Hungary', 'Ferenc Legend'], ['Slovenia', 'Zlatko Spare'],
  ]
  EASTERN.forEach(([nat, name], i) => leaguePlayer(name, nat, 'Serie A', 40 - i))
  // And a crowd from elsewhere in the same league, who must not turn up.
  for (let i = 0; i < 12; i++) leaguePlayer(`Italian Lad ${i}`, 'Italy', 'Serie A', 90)

  const cands = candidatesForType('continent-league')
  const serie = cands.find(
    (c) => c.params.league === 'Serie A' && c.params.continent === 'eastern-europe' && c.metric === 'goals',
  )
  assert.ok(serie)
  assert.equal(serie.title, 'Eastern European Serie A players (most goals)')
  assert.equal(serie.answer_count, EASTERN.length)

  const answers = answersForRound('continent-league', { continent: 'eastern-europe', league: 'Serie A' }, 'goals')
  assert.equal(answers.length, 10)
  assert.equal(answers[0].name, 'Zvonimir Winger')
  assert.equal(answers.some((a) => a.name.startsWith('Italian Lad')), false)

  // Being European in a European league is not a question, so Europe maps
  // nationalities here as everywhere and asks nothing.
  assert.equal(cands.some((c) => c.params.continent === 'europe'), false)
})
