import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchesName, norm, surnameOf } from './nameMatch.ts'

// These cases are the contract with client/src/pages/TenablePage.tsx's
// matches(). If one of them starts failing, the web game and the app have
// drifted apart and will accept different guesses for the same board.

test('exact and case/accent-insensitive matches', () => {
  assert.ok(matchesName('Javier Zanetti', 'Javier Zanetti'))
  assert.ok(matchesName('javier zanetti', 'Javier Zanetti'))
  assert.ok(matchesName('  Javier   Zanetti ', 'Javier Zanetti'.replace('  ', ' ')))
  assert.ok(matchesName('Mauro Zarate', 'Mauro Zárate'))
  assert.ok(matchesName('Gianluca Zambrotta', 'Gianluca Zambrotta'))
})

test('a bare surname is accepted', () => {
  assert.ok(matchesName('Zanetti', 'Javier Zanetti'))
  assert.ok(matchesName('Zidane', 'Zinedine Zidane'))
})

test('one typo in a surname is forgiven', () => {
  assert.ok(matchesName('Zenge', 'Walter Zenga'))
  assert.ok(matchesName('Zidnae', 'Zinedine Zidane'), 'transposition')
})

test('two errors are not forgiven', () => {
  assert.ok(!matchesName('Zxxga', 'Walter Zenga'))
})

test('a short surname is accepted exactly, and only exactly', () => {
  // This used to refuse a short surname outright, "exact or not". It was
  // reported from a game: "Flo" was a miss on Håvard Flo, in a round about
  // surnames beginning with F, while "Havard Flo" scored. The man's whole
  // surname, spelled correctly, turned down for being three letters.
  //
  // The length cut-off is really about LATITUDE, not distinctiveness —
  // ambiguity is already tolerated one character up, where "Cole" is accepted
  // for both Andy and Joe. Refusing three was the inconsistency.
  assert.ok(matchesName('Flo', 'Håvard Flo'))
  assert.ok(matchesName('Son', 'Heung-min Son'))
  assert.ok(matchesName('Xu', 'Li Xu'))

  // Exactly, though. A short surname gets no spelling allowance at all,
  // because at three characters one edit is a different person.
  assert.ok(!matchesName('Fla', 'Håvard Flo'))
  assert.ok(!matchesName('Flu', 'Håvard Flo'))
  assert.ok(!matchesName('Sun', 'Heung-min Son'))

  // And it has to be the surname, not a first name that happens to be short.
  assert.ok(!matchesName('Li', 'Li Xu'))

  // A guess carrying a DIFFERENT first name is still a different person —
  // Tore André Flo and Jostein Flo are not Håvard.
  assert.ok(!matchesName('Tore Flo', 'Håvard Flo'))

  // The full name still works.
  assert.ok(matchesName('Heung-min Son', 'Heung-min Son'))
})

test('a surname typed in full matches, particles and all', () => {
  // surnameOf takes the last word, so van der Sar's "surname" is "sar" — three
  // characters, and the short-surname guard above then rejected the man's
  // actual surname typed in full. Only "Edwin van der Sar" worked.
  assert.ok(matchesName('van der Sar', 'Edwin van der Sar'))
  assert.ok(matchesName('Van der Sar', 'Edwin van der Sar'))
  assert.ok(matchesName('de Boer', 'Frank de Boer'))
  // The bare short surname is still not enough to go on — unchanged.
  assert.ok(!matchesName('Sar', 'Edwin van der Sar'))
  // And a tail is a tail: a middle fragment is not a name.
  assert.ok(!matchesName('van der', 'Edwin van der Sar'))
  assert.ok(!matchesName('der Sar', 'Edwin van der Vaart'))
})

test('fuzzy matching is distance 1, not distance 3', () => {
  assert.ok(!matchesName('Kane', 'Andy Cole'))
  // Four-character surnames one edit apart DO match — "Bale"/"Hale" is the
  // price of forgiving a typo, and the web game accepts it too.
  assert.ok(matchesName('Bale', 'Gareth Hale'))
})

test('a wrong name is rejected', () => {
  assert.ok(!matchesName('Dave Smith', 'Javier Zanetti'))
  assert.ok(!matchesName('Zola', 'Javier Zanetti'))
})

test('transliteration', () => {
  assert.equal(norm('Zlatan Ibrahimović'), 'zlatan ibrahimovic')
  assert.equal(norm('Łukasz Fabiański'), 'lukasz fabianski')
  assert.equal(surnameOf(norm('van der Vaart')), 'vaart')
})
