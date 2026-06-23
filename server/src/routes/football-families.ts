import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { sqlite } from '../db/client.ts'
import { scrapeFamilyLinks } from '../services/scraper.ts'

export const footballFamiliesRouter = new Hono()

// Normalize a Wikipedia URL's title for fuzzy matching (same logic as
// ballon-dor-schedule.ts) so relatives resolve to footballers in our DB.
function normalizeWikiTitle(url: string): string {
  const afterWiki = url.split('/wiki/').pop() ?? ''
  return decodeURIComponent(afterWiki)
    .replace(/_/g, ' ')
    .replace(/\s*\(.*?\)\s*$/, '')
    .normalize('NFD').replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
}

function footballerByTitle(): Map<string, { id: number; name: string }> {
  const rows = sqlite
    .prepare(`SELECT id, name, wikipedia_url FROM footballers WHERE wikipedia_url IS NOT NULL`)
    .all() as { id: number; name: string; wikipedia_url: string }[]
  const map = new Map<string, { id: number; name: string }>()
  for (const r of rows) {
    const key = normalizeWikiTitle(r.wikipedia_url)
    if (key && !map.has(key)) map.set(key, { id: r.id, name: r.name })
  }
  return map
}

// GET /api/football-families/scan — SSE: scan every footballer's bio for relatives
footballFamiliesRouter.get('/scan', async (c) => {
  const abortSignal = c.req.raw.signal
  return streamSSE(c, async (stream) => {
    const all = sqlite
      .prepare(`SELECT id, name, wikipedia_url FROM footballers WHERE wikipedia_url IS NOT NULL ORDER BY name`)
      .all() as { id: number; name: string; wikipedia_url: string }[]
    const byTitle = footballerByTitle()

    await stream.writeSSE({
      data: JSON.stringify({ type: 'init', total: all.length, players: all.map((p) => ({ id: p.id, name: p.name })) }),
    })

    const clearStmt = sqlite.prepare(`DELETE FROM football_family_links WHERE footballer_id = ?`)
    const insertStmt = sqlite.prepare(
      `INSERT OR IGNORE INTO football_family_links
       (footballer_id, relative_name, relative_wikipedia_url, relationship, relative_footballer_id)
       VALUES (?, ?, ?, ?, ?)`,
    )

    for (const player of all) {
      if (abortSignal.aborted) break
      await stream.writeSSE({ data: JSON.stringify({ type: 'start', id: player.id }) })
      try {
        const links = await scrapeFamilyLinks(player.wikipedia_url)
        clearStmt.run(player.id)
        for (const l of links) {
          const match = byTitle.get(normalizeWikiTitle(l.wikipedia_url))
          if (match && match.id === player.id) continue // self
          insertStmt.run(player.id, l.name, l.wikipedia_url, l.relationship, match?.id ?? null)
        }
        await stream.writeSSE({ data: JSON.stringify({ type: 'done', id: player.id, relativesFound: links.length }) })
      } catch (e) {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'failed', id: player.id, error: e instanceof Error ? e.message : 'Unknown error' }),
        })
      }
      await new Promise<void>((r) => setTimeout(r, 1000))
    }

    await stream.writeSSE({ data: JSON.stringify({ type: 'complete' }) })
  })
})

// GET /api/football-families/summary — two lists: related pairs in the DB, and
// relatives that would need scraping.
footballFamiliesRouter.get('/summary', (c) => {
  // Pairs where the relative is already a footballer in our DB.
  const inDbRows = sqlite
    .prepare(
      `SELECT fl.footballer_id AS aId, fa.name AS aName,
              fl.relative_footballer_id AS bId, fb.name AS bName,
              fl.relationship
       FROM football_family_links fl
       JOIN footballers fa ON fa.id = fl.footballer_id
       JOIN footballers fb ON fb.id = fl.relative_footballer_id
       WHERE fl.relative_footballer_id IS NOT NULL`,
    )
    .all() as { aId: number; aName: string; bId: number; bName: string; relationship: string | null }[]

  const seen = new Set<string>()
  const inDb: { aId: number; aName: string; bId: number; bName: string; relationship: string | null }[] = []
  for (const r of inDbRows) {
    const key = [Math.min(r.aId, r.bId), Math.max(r.aId, r.bId)].join('-')
    if (seen.has(key)) continue
    seen.add(key)
    inDb.push(r)
  }
  inDb.sort((a, b) => a.aName.localeCompare(b.aName))

  // Relatives not in our DB, grouped by their Wikipedia page.
  const toScrapeRows = sqlite
    .prepare(
      `SELECT fl.relative_name AS relativeName, fl.relative_wikipedia_url AS relativeUrl,
              fl.relationship, fa.id AS relatedId, fa.name AS relatedName
       FROM football_family_links fl
       JOIN footballers fa ON fa.id = fl.footballer_id
       WHERE fl.relative_footballer_id IS NULL
       ORDER BY fl.relative_name`,
    )
    .all() as { relativeName: string; relativeUrl: string; relationship: string | null; relatedId: number; relatedName: string }[]

  const grouped = new Map<
    string,
    { relativeName: string; relativeUrl: string; relatedTo: { id: number; name: string; relationship: string | null }[] }
  >()
  for (const r of toScrapeRows) {
    if (!grouped.has(r.relativeUrl)) {
      grouped.set(r.relativeUrl, { relativeName: r.relativeName, relativeUrl: r.relativeUrl, relatedTo: [] })
    }
    grouped.get(r.relativeUrl)!.relatedTo.push({ id: r.relatedId, name: r.relatedName, relationship: r.relationship })
  }
  const toScrape = [...grouped.values()].sort((a, b) => a.relativeName.localeCompare(b.relativeName))

  return c.json({ inDb, toScrape, inDbCount: inDb.length, toScrapeCount: toScrape.length })
})

// DELETE /api/football-families — clear all detected links
footballFamiliesRouter.delete('/', (c) => {
  sqlite.prepare(`DELETE FROM football_family_links`).run()
  return c.json({ ok: true })
})
