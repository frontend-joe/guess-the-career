import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// What a lookup is allowed to remember for ever.
//
// An article that is not a man who played association football will not be
// one tomorrow either, so that verdict is worth keeping and worth keeping
// permanently. The typed name it was reached through is worth nothing: ten
// footballers are called Carrasco, eight players in this database are called
// Johnson, and a verdict filed under the word writes off all of them.
//
// So the blacklist is keyed on the URL, and the only thing it can cost is one
// article nobody wanted.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'rejections-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { rejectArticle, articleRejected, resolveOrCreateFootballer, wikiUrlFor } =
  await import('./playerImport.ts')

const SINGER = 'https://en.wikipedia.org/wiki/Manuel_Carrasco'
const WINGER = 'https://en.wikipedia.org/wiki/Yannick_Carrasco'
const realFetch = globalThis.fetch

test.after(() => {
  globalThis.fetch = realFetch
})

test('a rejection is about one article and binds only that article', () => {
  rejectArticle(SINGER, 'not a male association footballer', 'Carrasco')

  assert.equal(articleRejected(SINGER), true)
  // The name they share is not evidence about the other man, and this is the
  // whole of the fix: the Spanish singer saying no says nothing whatsoever
  // about the Belgium international with 198 Atlético Madrid appearances.
  assert.equal(articleRejected(WINGER), false)
})

test('the same verdict twice is one row, not a crash', () => {
  rejectArticle(SINGER, 'not a male association footballer', 'carrasco again')
  const n = sqlite
    .prepare('SELECT COUNT(*) AS n FROM wikipedia_rejections WHERE url = ?')
    .get(SINGER) as { n: number }
  assert.equal(n.n, 1)
  // The first reason stands. A second sighting teaches nothing new.
  const row = sqlite
    .prepare('SELECT raw FROM wikipedia_rejections WHERE url = ?')
    .get(SINGER) as { raw: string }
  assert.equal(row.raw, 'Carrasco')
})

test('a rejected article is dropped before the shortlist, not inside it', async () => {
  // Wikipedia's search ranks by its own lights: shout "Carrasco" at it and
  // the singer comes back above the winger. Only five candidates are ever
  // scraped, so an article we have already judged must not occupy one of
  // those places — that is how the real player falls off the end.
  const asked: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    asked.push(url)
    if (url.includes('list=search')) {
      const titles = ['Manuel Carrasco'].map((title) => ({ title }))
      return new Response(JSON.stringify({ query: { search: titles } }), { status: 200 })
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as typeof globalThis.fetch

  const { id } = await resolveOrCreateFootballer('Carrasco', 'Atletico Madrid')
  assert.equal(id, null, 'the only candidate was one we had already ruled out')

  // Searched, yes. Scraped, never: the article was skipped without a single
  // request for it, which is the saving the blacklist exists for.
  assert.ok(asked.some((u) => u.includes('list=search')), 'it still searched')
  assert.equal(
    asked.some((u) => u === wikiUrlFor('Manuel Carrasco')),
    false,
    'a known rejection is never fetched again',
  )
})
