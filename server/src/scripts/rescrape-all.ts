import { db, runMigrations } from '../db/client.ts'
import { footballers, career_stints } from '../db/schema.ts'
import { scrapeWikipedia } from '../services/scraper.ts'
import { eq, sql } from 'drizzle-orm'

runMigrations()

const all = await db.select({ id: footballers.id, name: footballers.name, url: footballers.wikipedia_url }).from(footballers)

console.log(`Rescraping ${all.length} players...\n`)

let saved = 0
let failed = 0

for (const player of all) {
  process.stdout.write(`  ${player.name} ... `)
  try {
    const result = await scrapeWikipedia(player.url)

    await db.update(footballers)
      .set({
        name: result.name,
        nationality: result.nationality,
        position: result.position,
        born: result.born,
        updated_at: sql`(datetime('now'))`,
      })
      .where(eq(footballers.id, player.id))

    await db.delete(career_stints).where(eq(career_stints.footballer_id, player.id))
    if (result.stints.length > 0) {
      await db.insert(career_stints).values(
        result.stints.map((s, i) => ({ ...s, sort_order: i, footballer_id: player.id }))
      )
    }

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

console.log(`\nDone — ${saved} updated, ${failed} failed.`)
