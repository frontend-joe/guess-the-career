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
  // "Italy B" and "Great Britain" are not countries anybody is from, which is
  // what FOOTBALLING_NATIONS is for.
  assert.equal(nationalityFromInternationals([intl('Italy', 60), intl('Italy B', 4)]), 'Italy')
  assert.equal(nationalityFromInternationals([intl('England', 30), intl('Great Britain', 3)]), 'England')
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
