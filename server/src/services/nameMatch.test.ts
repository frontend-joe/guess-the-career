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

test('an answer with a short surname never matches on surname alone', () => {
  // The guard is on the ANSWER's surname: under four characters it is not
  // distinctive enough to accept on its own, exact or not.
  assert.ok(!matchesName('Xu', 'Li Xu'))
  assert.ok(!matchesName('Son', 'Heung-min Son'))
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
