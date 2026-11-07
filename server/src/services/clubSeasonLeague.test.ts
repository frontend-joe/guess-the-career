import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanDivisionCell, seasonLeague } from './scraper.ts'

// Which competition a club-seasons row belongs to. club_seasons is what
// resolves a league for every player whose own career statistics carry none,
// so a row stored under a name nothing recognises removes that player from
// league rounds entirely and silently.

const league = (raw: string, year: number, isEnglish = false) =>
  seasonLeague(cleanDivisionCell(raw), year, isEnglish)

test('a bracketed tier is stripped whichever numeral it is written in', () => {
  // The bug: only the Arabic form was handled. Valencia's seasons list writes
  // the Roman one, so nine seasons of Amedeo Carboni's La Liga career were
  // filed under "La Liga (I)" and he was not an answer to "Italy La Liga
  // players" despite 245 appearances.
  assert.equal(league('La Liga (I)', 2000), 'La Liga')
  assert.equal(league('La Liga (1)', 2000), 'La Liga')
  assert.equal(league('Bundesliga (I)', 1995), 'Bundesliga')
  assert.equal(league('Serie A (tier 1)', 1995), 'Serie A')
  // Promotion arrows go too, as they always did.
  assert.equal(league('La Liga (I) ↑', 2000), 'La Liga')
})

test('a bracket that is not a tier is left alone', () => {
  // Only a numeral is decoration. These say which competition it is.
  assert.equal(cleanDivisionCell('Div 3(S)'), 'Div 3(S)')
  assert.equal(cleanDivisionCell('Div Two(W)'), 'Div Two(W)')
  assert.equal(cleanDivisionCell('Série C (CE)'), 'Série C (CE)')
})

test('a foreign league that shares an English name is qualified, not adopted', () => {
  // Brann's "First Division (VI)" is the sixth tier of Norwegian football.
  // Stripping the tier is what makes this reachable: before it, the string
  // did not look like an English competition at all.
  assert.equal(league('First Division (VI)', 1980), 'First Division (non-English)')
  // Scotland's top flight was called the Premier League too. This is the case
  // the canon veto was written for; it must survive the new branch.
  assert.equal(league('Premier League', 2005), 'Premier League (non-English)')
  // And an English club keeps the English name.
  assert.equal(league('Premier League', 2005, true), 'Premier League')
})

test('English abbreviations still resolve by year', () => {
  // "Div 1" is the top flight until 1991-92 and the second tier after it.
  assert.equal(league('Div 1', 1985, true), 'First Division')
  assert.equal(league('Div 1', 1995, true), 'EFL Championship')
  assert.equal(league('Championship', 2010, true), 'EFL Championship')
  // Not applied to clubs we cannot vouch are English.
  assert.equal(league('Div 1', 1985), 'Div 1')
})

test('an unrecognised competition keeps its own name', () => {
  // Never null: a caller asking whether a spell stayed in one league has to
  // be able to see the seasons that fell outside the five we rank.
  assert.equal(league('Eredivisie', 2000), 'Eredivisie')
  assert.equal(league('Segunda División (II)', 2007), 'Segunda División')
})
