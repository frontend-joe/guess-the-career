import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sqlite } from '../db/client.ts'
import { baseNation, nationIso } from '../services/football.ts'

export const dualNationalityRouter = new Hono()

interface Nation {
  name: string
  years: string | null
}

interface DualPlayer {
  footballerId: number
  name: string
  photo_url: string | null
  position: string | null
  years: string | null
  nations: Nation[]
}

function yearsSpan(years: number[]): string | null {
  if (years.length === 0) return null
  const min = Math.min(...years)
  const max = Math.max(...years)
  return min === max ? String(min) : `${min}–${max}`
}

// Footballers who represented two or more distinct major nations at any level
// (youth/B/Olympic teams fold into the senior nation via nationIso).
function computeCandidates(): DualPlayer[] {
  const rows = sqlite
    .prepare(
      `SELECT cs.footballer_id, f.name, f.photo_url, f.position, cs.club, cs.years
       FROM career_stints cs
       JOIN footballers f ON f.id = cs.footballer_id
       WHERE cs.stint_type = 'international'`,
    )
    .all() as {
    footballer_id: number
    name: string
    photo_url: string | null
    position: string | null
    club: string
    years: string | null
  }[]

  type Group = { name: string; latestYear: number; years: number[] }
  const players = new Map<
    number,
    { name: string; photo_url: string | null; position: string | null; allYears: number[]; byIso: Map<string, Group> }
  >()

  for (const r of rows) {
    const iso = nationIso(r.club)
    if (!iso) continue
    if (!players.has(r.footballer_id)) {
      players.set(r.footballer_id, { name: r.name, photo_url: r.photo_url, position: r.position, allYears: [], byIso: new Map() })
    }
    const p = players.get(r.footballer_id)!
    const nums = (r.years?.match(/\d{4}/g) ?? []).map(Number)
    p.allYears.push(...nums)
    const maxYear = nums.length ? Math.max(...nums) : 0
    const display = baseNation(r.club)
    const g = p.byIso.get(iso)
    if (!g) {
      p.byIso.set(iso, { name: display, latestYear: maxYear, years: [...nums] })
    } else {
      g.years.push(...nums)
      // Prefer the most recent identity as the display name (e.g. Germany over
      // West Germany when both appear).
      if (maxYear >= g.latestYear) {
        g.latestYear = maxYear
        g.name = display
      }
    }
  }

  const out: DualPlayer[] = []
  for (const [footballerId, p] of players) {
    if (p.byIso.size < 2) continue
    const nations: (Nation & { minYear: number })[] = []
    for (const g of p.byIso.values()) {
      nations.push({
        name: g.name,
        years: yearsSpan(g.years),
        minYear: g.years.length ? Math.min(...g.years) : 9999,
      })
    }
    nations.sort((a, b) => a.minYear - b.minYear)
    out.push({
      footballerId,
      name: p.name,
      photo_url: p.photo_url,
      position: p.position,
      years: yearsSpan(p.allYears),
      nations: nations.map(({ name, years }) => ({ name, years })),
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

function includedIds(): Set<number> {
  const rows = sqlite.prepare(`SELECT footballer_id FROM dual_nationality_included`).all() as {
    footballer_id: number
  }[]
  return new Set(rows.map((r) => r.footballer_id))
}

// GET /api/dual-nationality/admin/players — all candidates with included flag
dualNationalityRouter.get('/admin/players', (c) => {
  const included = includedIds()
  const data = computeCandidates().map((p) => ({ ...p, included: included.has(p.footballerId) }))
  return c.json({ data, total: data.length, includedCount: included.size })
})

// POST /api/dual-nationality/admin/players/include { footballerId }
dualNationalityRouter.post(
  '/admin/players/include',
  zValidator('json', z.object({ footballerId: z.number().int() })),
  (c) => {
    sqlite
      .prepare(`INSERT OR IGNORE INTO dual_nationality_included (footballer_id) VALUES (?)`)
      .run(c.req.valid('json').footballerId)
    return c.json({ ok: true })
  },
)

// DELETE /api/dual-nationality/admin/players/include { footballerId }
dualNationalityRouter.delete(
  '/admin/players/include',
  zValidator('json', z.object({ footballerId: z.number().int() })),
  (c) => {
    sqlite
      .prepare(`DELETE FROM dual_nationality_included WHERE footballer_id = ?`)
      .run(c.req.valid('json').footballerId)
    return c.json({ ok: true })
  },
)

// GET /api/dual-nationality/answers — the playable (included) list
dualNationalityRouter.get('/answers', (c) => {
  const included = includedIds()
  return c.json(computeCandidates().filter((p) => included.has(p.footballerId)))
})
