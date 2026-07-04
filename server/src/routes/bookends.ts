import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sqlite } from '../db/client.ts'
import { normalizeClubAlias } from '../services/scraper.ts'

export const bookendsRouter = new Hono()

interface Bookend {
  footballerId: number
  name: string
  club: string
  clubWikipediaUrl: string | null
  clubCount: number
}

// Players who started and finished their senior career at the same club, having
// left and come back (>= 2 distinct clubs).
function computeBookends(): Bookend[] {
  const rows = sqlite
    .prepare(
      `SELECT cs.footballer_id, f.name, cs.club, cs.club_wikipedia_url, cs.sort_order
       FROM career_stints cs
       JOIN footballers f ON f.id = cs.footballer_id
       WHERE cs.stint_type = 'senior'
       ORDER BY cs.footballer_id, cs.sort_order ASC`,
    )
    .all() as {
    footballer_id: number
    name: string
    club: string
    club_wikipedia_url: string | null
    sort_order: number
  }[]

  const byPlayer = new Map<number, { name: string; stints: { club: string; url: string | null }[] }>()
  for (const r of rows) {
    if (!byPlayer.has(r.footballer_id)) byPlayer.set(r.footballer_id, { name: r.name, stints: [] })
    byPlayer.get(r.footballer_id)!.stints.push({ club: r.club, url: r.club_wikipedia_url })
  }

  const out: Bookend[] = []
  for (const [footballerId, p] of byPlayer) {
    if (p.stints.length < 2) continue
    const first = p.stints[0]
    const last = p.stints[p.stints.length - 1]
    const firstKey = normalizeClubAlias(first.club).toLowerCase()
    const lastKey = normalizeClubAlias(last.club).toLowerCase()
    if (firstKey !== lastKey) continue
    const distinct = new Set(p.stints.map((s) => normalizeClubAlias(s.club).toLowerCase()))
    if (distinct.size < 2) continue
    out.push({
      footballerId,
      name: p.name,
      club: first.club.replace(/^→\s*/, '').replace(/\s*\((loan|trial)\)\s*$/i, ''),
      clubWikipediaUrl: first.url,
      clubCount: distinct.size,
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

function excludedIds(): Set<number> {
  const rows = sqlite.prepare(`SELECT footballer_id FROM bookends_excluded`).all() as { footballer_id: number }[]
  return new Set(rows.map((r) => r.footballer_id))
}

// ── Admin ───────────────────────────────────────────────────────────────────
// GET /api/bookends/admin/players
bookendsRouter.get('/admin/players', (c) => {
  const excluded = excludedIds()
  const data = computeBookends().map((b) => ({ ...b, included: !excluded.has(b.footballerId) }))
  return c.json({ data, total: data.length, includedCount: data.filter((d) => d.included).length })
})

// POST /api/bookends/admin/players/include { footballerId, included }
bookendsRouter.post(
  '/admin/players/include',
  zValidator('json', z.object({ footballerId: z.number().int(), included: z.boolean() })),
  (c) => {
    const { footballerId, included } = c.req.valid('json')
    if (included) {
      sqlite.prepare(`DELETE FROM bookends_excluded WHERE footballer_id = ?`).run(footballerId)
    } else {
      sqlite.prepare(`INSERT OR IGNORE INTO bookends_excluded (footballer_id) VALUES (?)`).run(footballerId)
    }
    return c.json({ ok: true })
  },
)

// ── Schedule ────────────────────────────────────────────────────────────────
bookendsRouter.get('/schedule', (c) => {
  const rows = sqlite
    .prepare(
      `SELECT bs.id, bs.date, bs.footballer_id AS footballerId, f.name AS footballerName, bs.created_at
       FROM bookends_schedule bs JOIN footballers f ON f.id = bs.footballer_id
       ORDER BY bs.date ASC`,
    )
    .all()
  return c.json(rows)
})

// GET /api/bookends/schedule/rounds — playable rounds
bookendsRouter.get('/schedule/rounds', (c) => {
  const rows = sqlite
    .prepare(`SELECT date, footballer_id AS footballerId FROM bookends_schedule ORDER BY date ASC`)
    .all()
  return c.json(rows)
})

bookendsRouter.put(
  '/schedule/:date',
  zValidator('json', z.object({ footballerId: z.number().int() })),
  (c) => {
    const date = c.req.param('date')
    const { footballerId } = c.req.valid('json')
    const existing = sqlite.prepare(`SELECT id FROM bookends_schedule WHERE date = ?`).get(date)
    if (existing) {
      sqlite.prepare(`UPDATE bookends_schedule SET footballer_id = ? WHERE date = ?`).run(footballerId, date)
    } else {
      sqlite.prepare(`INSERT INTO bookends_schedule (date, footballer_id) VALUES (?, ?)`).run(date, footballerId)
    }
    return c.json({ ok: true })
  },
)

bookendsRouter.delete('/schedule/:date', (c) => {
  sqlite.prepare(`DELETE FROM bookends_schedule WHERE date = ?`).run(c.req.param('date'))
  return c.json({ ok: true })
})

bookendsRouter.delete('/schedule', (c) => {
  sqlite.prepare(`DELETE FROM bookends_schedule`).run()
  return c.json({ ok: true })
})
