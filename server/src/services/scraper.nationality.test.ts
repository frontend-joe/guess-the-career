import { test } from 'node:test'
import assert from 'node:assert/strict'

import { nationalityFromInternationals } from './scraper.ts'

// A player belongs to the country they played for, and the infobox gives us
// the rows to work that out from. The hard part is that it writes a career and
// a novelty the same way.

function intl(club: string, apps: number | null) {
  return { club, apps, stint_type: 'international' }
}

test('one guest appearance does not outrank a career', () => {
  // Platini, as the infobox has him: France for eleven years, then a single
  // friendly for Kuwait in 1988, a year after he retired. The old rule took
  // the last row and filed 147 Juventus appearances as Asian.
  const nat = nationalityFromInternationals([
    { club: 'Nancy', apps: 181, stint_type: 'senior' },
    intl('France Olympic', 7),
    intl('France', 72),
    intl('Kuwait', 1),
  ])
  assert.equal(nat, 'France')
})

test('a player who switched allegiance belongs to the country they switched to', () => {
  // The case the old rule existed for, and it still comes out right — a switch
  // brings a career with it.
  assert.equal(nationalityFromInternationals([intl('Republic of Ireland', 3), intl('England', 59)]), 'England')
  assert.equal(nationalityFromInternationals([intl('Brazil', 2), intl('Spain', 24)]), 'Spain')
})

test('youth and B teams never decide it', () => {
  // "Great Britain" is not a country anybody is from, which is what
  // FOOTBALLING_NATIONS is for.
  assert.equal(nationalityFromInternationals([intl('Italy', 60), intl('Italy B', 4)]), 'Italy')
  assert.equal(nationalityFromInternationals([intl('England', 30), intl('Great Britain', 3)]), 'England')
})

test('youth caps do not count for the country they left', () => {
  // The trap in counting caps at all: youth football is HOW a switcher piles
  // up appearances for the country they walked away from. All six of these are
  // real rows from the database, and under a rule that counted the U21s every
  // one of them would have been filed English, German or Spanish.
  assert.equal(
    nationalityFromInternationals([intl('England U21', 20), intl('Nigeria', 10)]),
    'Nigeria',
  )
  assert.equal(
    nationalityFromInternationals([
      intl('England U16', 16), intl('England U19', 20), intl('England U20', 4),
      intl('England U21', 18), intl('Trinidad and Tobago', 18),
    ]),
    'Trinidad and Tobago',
  )
  assert.equal(
    nationalityFromInternationals([
      intl('Germany U19', 12), intl('Germany U21', 6), intl('Ghana', 15),
    ]),
    'Ghana',
  )
  // Including when the senior side they ended up with gave them two caps and
  // the youth sides gave them thirty-five.
  assert.equal(
    nationalityFromInternationals([
      intl('France U17', 19), intl('France U19', 7), intl('France U21', 1), intl('Mali', 2),
    ]),
    'Mali',
  )
  // An Olympic side is not a senior side either — Platini's seven games for
  // France Olympic are the same kind of row.
  assert.equal(
    nationalityFromInternationals([intl('Spain Olympic', 9), intl('Cape Verde', 2)]),
    'Cape Verde',
  )
})

test('a country that still exists beats one that does not', () => {
  // Forty-three caps for Czechoslovakia against six for the Czech Republic is
  // a Czech: by 1994 there was no Czechoslovakia left to play for.
  assert.equal(
    nationalityFromInternationals([intl('Czechoslovakia', 43), intl('Czech Republic', 6)]),
    'Czech Republic',
  )
  // But a player who only ever played for the defunct state keeps it. A
  // nationality is whatever the infobox said at the time.
  assert.equal(nationalityFromInternationals([intl('Czechoslovakia', 43)]), 'Czechoslovakia')
  assert.equal(nationalityFromInternationals([intl('Yugoslavia', 30)]), 'Yugoslavia')
})

test('equal caps either side goes to the last listed', () => {
  // Somebody mid-switch, with nothing to choose between them on caps. The old
  // rule is the right answer here and this keeps it.
  assert.equal(nationalityFromInternationals([intl('Morocco', 5), intl('Spain', 5)]), 'Spain')
})

test('a spell with no recorded caps still counts for something', () => {
  // An unknown apps count is not zero caps. Counting it as one keeps a single
  // numbered row from quietly deciding the whole question.
  assert.equal(nationalityFromInternationals([intl('Wales', null), intl('Wales', null), intl('England', 1)]), 'Wales')
})

test('no international career at all leaves it to the birthplace', () => {
  assert.equal(nationalityFromInternationals([{ club: 'Nancy', apps: 181, stint_type: 'senior' }]), null)
  assert.equal(nationalityFromInternationals([]), null)
})
