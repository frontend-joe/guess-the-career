import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as cheerio from 'cheerio'

import { parseCareerStatistics } from './scraper.ts'

// Wikipedia breaks a long name over two lines with <br>, and for a long time
// we read the two halves as one word. It cost Niko Kranjčar his place on a
// board about Tottenham Hotspur: his 71 appearances were filed under
// "TottenhamHotspur", which is not a club anybody can ask for.

function table(rows: string): cheerio.CheerioAPI {
  return cheerio.load(`
    <table class="wikitable">
      <tr>
        <th rowspan="2">Club</th><th rowspan="2">Season</th><th rowspan="2">Division</th>
        <th colspan="2">League</th><th colspan="2">Total</th>
      </tr>
      <tr><th>Apps</th><th>Goals</th><th>Apps</th><th>Goals</th></tr>
      ${rows}
    </table>`)
}

test('a club broken across two lines is still one club with a space in it', () => {
  const rows = parseCareerStatistics(
    table('<tr><td>Tottenham<br>Hotspur</td><td>2009–10</td><td>Premier League</td><td>24</td><td>3</td><td>32</td><td>7</td></tr>'),
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].club, 'Tottenham Hotspur')
  assert.equal(rows[0].total_apps, 32)
})

test('a division broken across two lines keeps its space too', () => {
  const rows = parseCareerStatistics(
    table('<tr><td>Dynamo Kyiv</td><td>2012–13</td><td>Ukrainian<br>Premier League</td><td>13</td><td>4</td><td>21</td><td>5</td></tr>'),
  )
  assert.equal(rows[0].division, 'Ukrainian Premier League')
})

test('a loan broken across two lines is still a loan', () => {
  const rows = parseCareerStatistics(
    table('<tr><td>→ Queens Park<br>Rangers (loan)</td><td>2013–14</td><td>Championship</td><td>29</td><td>2</td><td>33</td><td>2</td></tr>'),
  )
  assert.equal(rows[0].club, 'Queens Park Rangers (loan)')
})

test('a name that was never broken is left exactly as it is', () => {
  // The repair must not invent spaces: VfL Wolfsburg and NorthEast United are
  // spelled that way on purpose.
  const rows = parseCareerStatistics(
    table('<tr><td>VfL Wolfsburg</td><td>2015–16</td><td>Bundesliga</td><td>30</td><td>5</td><td>40</td><td>8</td></tr>'),
  )
  assert.equal(rows[0].club, 'VfL Wolfsburg')
})
