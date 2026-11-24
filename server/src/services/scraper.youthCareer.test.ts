import { test } from 'node:test'
import assert from 'node:assert/strict'

import { scrapeWikipedia } from './scraper.ts'

// A footballer's infobox has three career sections and we only ever read two
// of them. "Youth career" was skipped outright, so where a player came
// through — half of every argument about a young one — was nowhere in the
// database.
//
// Two things hid it. The section's rows put the club in a plain
// `infobox-data` cell rather than the lettered `infobox-data-a` a senior row
// uses, because there are no apps or goals columns to letter against. And an
// undated spell is printed with an invisible "0000" in front of the dash,
// purely so the row sorts, which the old reader swept up into the years.

const realFetch = globalThis.fetch

function page(sections: string): void {
  const html = `
    <html><body>
      <h1 id="firstHeading">Test Player</h1>
      <table class="infobox vcard">
        <tbody>
          <tr><th class="infobox-header">Personal information</th></tr>
          ${sections}
        </tbody>
      </table>
    </body></html>`
  globalThis.fetch = (async () => new Response(html, { status: 200 })) as typeof globalThis.fetch
}

const YOUTH = `
  <tr><th colspan="4" class="infobox-header">Youth career</th></tr>
  <tr>
    <th class="infobox-label"><span>1999–2001</span></th>
    <td class="infobox-data">Ridgeway Rovers</td>
  </tr>
  <tr>
    <th class="infobox-label">
      <span><span aria-hidden="true" style="visibility:hidden">0000</span>–2005</span>
    </th>
    <td class="infobox-data">Derby County</td>
  </tr>`

const SENIOR = `
  <tr><th colspan="4" class="infobox-header">Senior career*</th></tr>
  <tr>
    <th class="infobox-label"><span>Years</span></th>
    <td class="infobox-data infobox-data-a">Team</td>
    <td class="infobox-data infobox-data-b">Apps</td>
    <td class="infobox-data infobox-data-c">(Gls)</td>
  </tr>
  <tr>
    <th class="infobox-label"><span>2005–2009</span></th>
    <td class="infobox-data infobox-data-a">Derby County</td>
    <td class="infobox-data infobox-data-b">43</td>
    <td class="infobox-data infobox-data-c">(5)</td>
  </tr>`

test.after(() => {
  globalThis.fetch = realFetch
})

test('a youth career is read, and kept apart from the senior one', async () => {
  page(YOUTH + SENIOR)
  const { stints } = await scrapeWikipedia('https://en.wikipedia.org/wiki/Test_Player')

  const youth = stints.filter((s) => s.stint_type === 'youth')
  const senior = stints.filter((s) => s.stint_type === 'senior')

  assert.deepEqual(
    youth.map((s) => [s.years, s.club]),
    [
      ['1999–2001', 'Ridgeway Rovers'],
      // The hidden sort key is gone; what is left is the truth, which is
      // that he was there until 2005 and nobody recorded from when.
      ['–2005', 'Derby County'],
    ],
  )

  // The same club twice, once as a boy and once as a man, and only the
  // second one is a spell he played. Every round in the game derives a
  // club's players from senior stints, so this is the line that matters.
  assert.deepEqual(senior.map((s) => [s.years, s.club, s.apps]), [['2005–2009', 'Derby County', 43]])
})

test('a youth spell carries no appearances, rather than nought', async () => {
  page(YOUTH)
  const { stints } = await scrapeWikipedia('https://en.wikipedia.org/wiki/Test_Player')
  // Null, not 0. Nobody counted; he did not fail to get on.
  for (const s of stints) {
    assert.equal(s.apps, null)
    assert.equal(s.goals, null)
  }
})

test('a page with no youth section is unchanged', async () => {
  page(SENIOR)
  const { stints } = await scrapeWikipedia('https://en.wikipedia.org/wiki/Test_Player')
  assert.deepEqual(stints.map((s) => s.stint_type), ['senior'])
  assert.equal(stints[0].apps, 43)
})
