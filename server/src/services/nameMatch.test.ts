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
  // Length buys LATITUDE, not distinctiveness — ambiguity is already tolerated
  // one character up, where "Cole" is accepted for both Andy and Joe. These
  // are all real players in the database, and all whole surnames.
  assert.ok(matchesName('Flo', 'Håvard Flo', 'Flo'))
  assert.ok(matchesName('Ba', 'Demba Ba', 'Ba'))
  assert.ok(matchesName('Foe', 'Marc-Vivien Foé', 'Foé'))
  assert.ok(matchesName('Obi', 'Mikel John Obi', 'Obi'))
  assert.ok(matchesName('Te', 'Ricardo Vaz Tê', 'Tê'))
  // Jô is a whole name of two letters, so it never reaches the surname rules
  // at all — but it is the case that prompted the question, so it is pinned.
  assert.ok(matchesName('Jo', 'Jô', 'Jô'))

  // Exactly, though. A short surname gets no spelling allowance, because at
  // two or three characters one edit is a different person.
  assert.ok(!matchesName('Fla', 'Håvard Flo', 'Flo'))
  assert.ok(!matchesName('Flu', 'Håvard Flo', 'Flo'))
  assert.ok(!matchesName('Bo', 'Demba Ba', 'Ba'))

  // And a different first name is still a different person: Håvard, Jostein
  // and Tore André Flo are three separate players, all in the database.
  assert.ok(!matchesName('Tore Flo', 'Håvard Flo', 'Flo'))
})

test('the recorded surname beats the last word of the name', () => {
  // Seventy-seven players in the database have a surname that is not simply
  // the last word of their name, and it has been correctly split there the
  // whole time. Guessing it from the name gets every one of these wrong.
  assert.ok(!matchesName('Sar', 'Edwin van der Sar', 'van der Sar'))
  assert.ok(matchesName('van der Sar', 'Edwin van der Sar', 'van der Sar'))
  assert.ok(!matchesName('Gea', 'David de Gea', 'de Gea'))
  assert.ok(matchesName('de Gea', 'David de Gea', 'de Gea'))

  // A generational suffix is not a surname. Nothing about the last word says
  // so; the recorded surname does.
  assert.ok(!matchesName('Jr', 'Alan Kelly Jr.', 'Kelly Jr.'))
  assert.ok(matchesName('Kelly', 'Alan Kelly Jr.', 'Kelly Jr.'))

  // And the surname is not always at the end. Zheng Zhi's is Zheng — the
  // FIRST word — which no amount of looking at the last one can discover.
  assert.ok(matchesName('Zheng', 'Zheng Zhi', 'Zheng'))
  assert.ok(!matchesName('Zhi', 'Zheng Zhi', 'Zheng'))
})

test('without a recorded surname it falls back to the last word', () => {
  // Authored answers and scraped transfer rows naming somebody with no
  // footballer record have no surname to look up. The last word is the best
  // guess available and is what every board used before.
  assert.ok(matchesName('Flo', 'Håvard Flo'))
  assert.ok(matchesName('Ba', 'Demba Moussa Ba'))
  assert.ok(!matchesName('Fla', 'Håvard Flo'))

  // With one check the name itself can answer: a particle in front of the
  // last word says it is a fragment of a longer surname.
  assert.ok(!matchesName('Sar', 'Edwin van der Sar'))
  assert.ok(!matchesName('Red', 'Rubén de la Red'))
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

test('a forename on its own is not a guess at anybody', () => {
  // The board that forced this: "La Liga players named Fernando", where the
  // word fits all ten rows and typing it ten times used to clear them.
  assert.equal(matchesName('Fernando', 'Fernando Torres', 'Torres'), false)
  assert.equal(matchesName('Fernando', 'Fernando Hierro', 'Hierro'), false)
  // Raúl is the name people say, and he is now reached by his surname. That
  // is the price of the rule above, paid knowingly.
  assert.equal(matchesName('Raul', 'Raul Gonzalez', 'Gonzalez'), false)
  assert.equal(matchesName('Gonzalez', 'Raul Gonzalez', 'Gonzalez'), true)
})

test('a player whose whole name is one word is still typed as that word', () => {
  // Nothing was lost for the players the deleted rule was written for: a
  // one-name player has that name recorded as their whole name, and the
  // exact match takes it.
  assert.equal(matchesName('Kaka', 'Kaká', 'Kaká'), true)
  assert.equal(matchesName('Ronaldinho', 'Ronaldinho', 'Ronaldinho'), true)
  assert.equal(matchesName('Doni', 'Doni', 'Doni'), true)
})
