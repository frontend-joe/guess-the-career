import { db, runMigrations } from '../db/client.ts'
import { footballers } from '../db/schema.ts'
import { scrapeWikipedia } from '../services/scraper.ts'
import { applyScrapeResult } from '../services/footballers.ts'
import { rebuildClubs } from '../services/clubs.ts'
import { setAppMeta } from '../services/appMeta.ts'

runMigrations()

const all = await db
  .select({ id: footballers.id, name: footballers.name, url: footballers.wikipedia_url, photo_url: footballers.photo_url })
  .from(footballers)

console.log(`Rescraping ${all.length} players...\n`)

let saved = 0
let failed = 0

for (const player of all) {
  process.stdout.write(`  ${player.name} ... `)
  try {
    const result = await scrapeWikipedia(player.url)
    await applyScrapeResult(player.id, result, player.photo_url)

    const intlCount = result.stints.filter(s => s.stint_type === 'international').length
    console.log(`✓  (${result.stints.length} stints${intlCount ? `, ${intlCount} intl` : ''}, nationality: ${result.nationality ?? '—'})`)
    saved++
  } catch (e) {
    console.log(`✗  ${e instanceof Error ? e.message : e}`)
    failed++
  }

  // Avoid hammering Wikipedia
  await new Promise(r => setTimeout(r, 500))
}

// Rebuild the clubs table from the freshly canonicalized stints and stamp the date.
rebuildClubs()
setAppMeta('last_rescrape', new Date().toISOString().slice(0, 10))

console.log(`\nDone — ${saved} updated, ${failed} failed.`)
