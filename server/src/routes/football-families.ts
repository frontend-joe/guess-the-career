import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sqlite } from '../db/client.ts'
import { scrapeFamilyLinks, scrapeWikipedia, normalizeClubAlias } from '../services/scraper.ts'

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

// GET /api/football-families/players — work list for client-driven batch scan
footballFamiliesRouter.get('/players', (c) => {
  const all = sqlite
    .prepare(`SELECT id, name FROM footballers WHERE wikipedia_url IS NOT NULL ORDER BY name`)
    .all()
  return c.json(all)
})

// POST /api/football-families/scan-batch { ids } — scan a small batch of players.
// Client-driven batching keeps each request short so prod proxies don't cut off a
// long-lived stream. Returns the relatives found so the UI can list them live.
footballFamiliesRouter.post(
  '/scan-batch',
  zValidator('json', z.object({ ids: z.array(z.number().int()).min(1).max(20) })),
  async (c) => {
    const { ids } = c.req.valid('json')
    const byTitle = footballerByTitle()
    const prevStmt = sqlite.prepare(
      `SELECT relative_wikipedia_url AS url, included FROM football_family_links WHERE footballer_id = ?`,
    )
    const clearStmt = sqlite.prepare(`DELETE FROM football_family_links WHERE footballer_id = ?`)
    const insertStmt = sqlite.prepare(
      `INSERT INTO football_family_links
       (footballer_id, relative_name, relative_wikipedia_url, relationship, relative_footballer_id, included)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )

    const results: {
      id: number
      name: string
      error?: string
      relatives?: {
        linkId: number
        relativeName: string
        relativeUrl: string
        relationship: string | null
        relativeFootballerId: number | null
        included: boolean
      }[]
    }[] = []

    for (const id of ids) {
      const row = sqlite.prepare(`SELECT id, name, wikipedia_url FROM footballers WHERE id = ?`).get(id) as
        | { id: number; name: string; wikipedia_url: string | null }
        | undefined
      if (!row?.wikipedia_url) { results.push({ id, name: row?.name ?? '', relatives: [] }); continue }
      try {
        const links = await scrapeFamilyLinks(row.wikipedia_url)
        // Preserve prior validation across re-scans.
        const prev = prevStmt.all(id) as { url: string; included: number }[]
        const prevInc = new Map(prev.map((p) => [p.url, p.included]))
        clearStmt.run(id)
        const relatives: NonNullable<(typeof results)[number]['relatives']> = []
        for (const l of links) {
          const match = byTitle.get(normalizeWikiTitle(l.wikipedia_url))
          if (match && match.id === id) continue
          const inc = prevInc.get(l.wikipedia_url) ?? 0
          const info = insertStmt.run(id, l.name, l.wikipedia_url, l.relationship, match?.id ?? null, inc)
          relatives.push({
            linkId: Number(info.lastInsertRowid),
            relativeName: l.name,
            relativeUrl: l.wikipedia_url,
            relationship: l.relationship,
            relativeFootballerId: match?.id ?? null,
            included: !!inc,
          })
        }
        results.push({ id, name: row.name, relatives })
      } catch (e) {
        results.push({ id, name: row.name, error: e instanceof Error ? e.message : 'Unknown error' })
      }
      await new Promise<void>((r) => setTimeout(r, 250))
    }
    return c.json({ results })
  },
)

// POST /api/football-families/include { id, included } — validate a relationship
footballFamiliesRouter.post(
  '/include',
  zValidator('json', z.object({ id: z.number().int(), included: z.boolean() })),
  (c) => {
    const { id, included } = c.req.valid('json')
    sqlite.prepare(`UPDATE football_family_links SET included = ? WHERE id = ?`).run(included ? 1 : 0, id)
    return c.json({ ok: true })
  },
)

// GET /api/football-families/summary — flat, deduped list of relationships with
// their validation state, plus counts.
footballFamiliesRouter.get('/summary', (c) => {
  const rows = sqlite
    .prepare(
      `SELECT fl.id, fl.footballer_id AS footballerId, fa.name AS footballerName,
              fl.relative_name AS relativeName, fl.relative_wikipedia_url AS relativeUrl,
              fl.relationship, fl.relative_footballer_id AS relativeFootballerId, fl.included
       FROM football_family_links fl
       JOIN footballers fa ON fa.id = fl.footballer_id
       ORDER BY fa.name`,
    )
    .all() as {
    id: number
    footballerId: number
    footballerName: string
    relativeName: string
    relativeUrl: string
    relationship: string | null
    relativeFootballerId: number | null
    included: number
  }[]

  const seen = new Map<string, number>() // pair key -> index in links
  const links: {
    id: number
    footballerName: string
    relativeName: string
    relativeUrl: string
    relationship: string | null
    inDb: boolean
    included: boolean
  }[] = []

  for (const r of rows) {
    const inDb = r.relativeFootballerId != null
    if (inDb) {
      const key = [Math.min(r.footballerId, r.relativeFootballerId!), Math.max(r.footballerId, r.relativeFootballerId!)].join('-')
      const existingIdx = seen.get(key)
      if (existingIdx != null) {
        if (r.included) links[existingIdx].included = true
        continue
      }
      seen.set(key, links.length)
    }
    links.push({
      id: r.id,
      footballerName: r.footballerName,
      relativeName: r.relativeName,
      relativeUrl: r.relativeUrl,
      relationship: r.relationship,
      inDb,
      included: !!r.included,
    })
  }

  return c.json({
    links,
    inDbCount: links.filter((l) => l.inDb).length,
    toScrapeCount: links.filter((l) => !l.inDb).length,
    includedCount: links.filter((l) => l.included).length,
  })
})

// POST /api/football-families/scrape-relative { url } — import a missing relative
// into the footballers DB and resolve the family links that point at them.
footballFamiliesRouter.post(
  '/scrape-relative',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    try {
      const result = await scrapeWikipedia(url)
      let footballerId: number
      const existing = sqlite
        .prepare(`SELECT id FROM footballers WHERE wikipedia_url = ?`)
        .get(result.wikipedia_url) as { id: number } | undefined
      if (existing) {
        footballerId = existing.id
      } else {
        const info = sqlite
          .prepare(
            `INSERT INTO footballers
             (name, wikipedia_url, nationality, position, all_positions, full_name, birthplace, born, height_cm, photo_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            result.name, result.wikipedia_url, result.nationality, result.position,
            result.all_positions ?? null, result.full_name ?? null, result.birthplace ?? null,
            result.born, result.height_cm, result.photo_url ?? null,
          )
        footballerId = Number(info.lastInsertRowid)
        if (result.stints.length > 0) {
          const insStint = sqlite.prepare(
            `INSERT INTO career_stints (footballer_id, sort_order, years, club, club_wikipedia_url, apps, goals, stint_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          result.stints.forEach((s, i) =>
            insStint.run(footballerId, i, s.years, s.club, s.club_wikipedia_url ?? null, s.apps ?? null, s.goals ?? null, s.stint_type),
          )
        }
      }

      // Resolve every family link pointing at this relative (by normalized title).
      const norm = normalizeWikiTitle(result.wikipedia_url)
      const unresolved = sqlite
        .prepare(`SELECT id, relative_wikipedia_url AS url FROM football_family_links WHERE relative_footballer_id IS NULL`)
        .all() as { id: number; url: string }[]
      const upd = sqlite.prepare(`UPDATE football_family_links SET relative_footballer_id = ? WHERE id = ?`)
      let resolved = 0
      for (const l of unresolved) {
        if (normalizeWikiTitle(l.url) === norm) { upd.run(footballerId, l.id); resolved++ }
      }

      return c.json({ ok: true, footballerId, name: result.name, resolved })
    } catch (e) {
      return c.json({ ok: false, error: e instanceof Error ? e.message : 'Scrape failed' }, 400)
    }
  },
)

// ── Game ────────────────────────────────────────────────────────────────────
interface FamilyMember {
  footballerId: number
  name: string
  nationality: string | null
  position: string | null
  clubName: string | null
  clubWikiUrl: string | null
  years: string | null
}

function yearsSpan(nums: number[]): string | null {
  if (nums.length === 0) return null
  const min = Math.min(...nums), max = Math.max(...nums)
  return min === max ? String(min) : `${min}–${max}`
}

// The club a player made the most senior appearances for, plus the years they
// were at that club.
function topClub(footballerId: number): { name: string; wikiUrl: string | null; years: string | null } | null {
  const stints = sqlite
    .prepare(`SELECT club, apps, years, club_wikipedia_url FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior'`)
    .all(footballerId) as { club: string; apps: number | null; years: string | null; club_wikipedia_url: string | null }[]
  const byClub = new Map<string, { apps: number; name: string; wikiUrl: string | null; years: number[] }>()
  for (const s of stints) {
    const key = normalizeClubAlias(s.club)
    const name = s.club.replace(/^→\s*/, '').replace(/\s*\((loan|trial)\)\s*$/i, '')
    const cur = byClub.get(key) ?? { apps: 0, name, wikiUrl: s.club_wikipedia_url, years: [] }
    cur.apps += s.apps ?? 0
    if (s.club_wikipedia_url && !cur.wikiUrl) cur.wikiUrl = s.club_wikipedia_url
    cur.years.push(...(s.years?.match(/\d{4}/g) ?? []).map(Number))
    byClub.set(key, cur)
  }
  let best: { apps: number; name: string; wikiUrl: string | null; years: number[] } | null = null
  for (const v of byClub.values()) if (!best || v.apps > best.apps) best = v
  return best ? { name: best.name, wikiUrl: best.wikiUrl, years: yearsSpan(best.years) } : null
}

function buildMember(id: number): FamilyMember {
  const f = sqlite.prepare(`SELECT id, name, nationality, position FROM footballers WHERE id = ?`).get(id) as
    { id: number; name: string; nationality: string | null; position: string | null }
  const tc = topClub(id)
  return {
    footballerId: id,
    name: f.name,
    nationality: f.nationality,
    position: f.position,
    clubName: tc?.name ?? null,
    clubWikiUrl: tc?.wikiUrl ?? null,
    years: tc?.years ?? null,
  }
}

// GET /api/football-families/game — deduped families (both members in the DB,
// included) for the playable list.
footballFamiliesRouter.get('/game', (c) => {
  const rows = sqlite
    .prepare(
      `SELECT footballer_id AS a, relative_footballer_id AS b, relationship
       FROM football_family_links
       WHERE included = 1 AND relative_footballer_id IS NOT NULL`,
    )
    .all() as { a: number; b: number; relationship: string | null }[]

  const seen = new Set<string>()
  const families = rows
    .filter((r) => {
      const key = [Math.min(r.a, r.b), Math.max(r.a, r.b)].join('-')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((r) => ({ relationship: r.relationship, members: [buildMember(r.a), buildMember(r.b)] }))

  families.sort((x, y) => x.members[0].name.localeCompare(y.members[0].name))
  return c.json(families)
})

// POST /api/football-families/manual { footballerName, relativeName, relationship }
// Manually add a relationship the scan missed. Both players must be in the DB.
// Resolved by name so the same call works across environments. Marked included.
footballFamiliesRouter.post(
  '/manual',
  zValidator('json', z.object({
    footballerName: z.string().min(1),
    relativeName: z.string().min(1),
    relationship: z.string().min(1),
  })),
  (c) => {
    const { footballerName, relativeName, relationship } = c.req.valid('json')
    const find = (n: string) =>
      sqlite
        .prepare(`SELECT id, name, wikipedia_url FROM footballers WHERE LOWER(normalize(name)) = LOWER(normalize(?)) LIMIT 1`)
        .get(n) as { id: number; name: string; wikipedia_url: string | null } | undefined
    const a = find(footballerName)
    const b = find(relativeName)
    const unresolved: string[] = []
    if (!a) unresolved.push(footballerName)
    if (!b) unresolved.push(relativeName)
    if (!a || !b) return c.json({ error: 'not_found', unresolved }, 404)
    if (a.id === b.id) return c.json({ error: 'same_player' }, 400)
    sqlite
      .prepare(
        `INSERT INTO football_family_links
         (footballer_id, relative_name, relative_wikipedia_url, relationship, relative_footballer_id, included)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(footballer_id, relative_wikipedia_url)
         DO UPDATE SET relationship = excluded.relationship, relative_footballer_id = excluded.relative_footballer_id, included = 1`,
      )
      .run(a.id, b.name, b.wikipedia_url, relationship, b.id)
    return c.json({ ok: true })
  },
)

// DELETE /api/football-families — clear all detected links
footballFamiliesRouter.delete('/', (c) => {
  sqlite.prepare(`DELETE FROM football_family_links`).run()
  return c.json({ ok: true })
})
