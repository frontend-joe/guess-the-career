import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, sqlite } from '../db/client.ts'
import { footballers, sop_schedule } from '../db/schema.ts'
import { isNotNull, sql } from 'drizzle-orm'

export const sopScheduleRouter = new Hono()

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const LETTER = `[a-zA-ZÀ-ÖØ-öø-ÿ]`
const NOT_BEFORE = `(?<![a-zA-ZÀ-ÖØ-öø-ÿ0-9])`
const NOT_AFTER  = `(?![a-zA-ZÀ-ÖØ-öø-ÿ0-9])`

function blankName(text: string, name: string): string {
  const parts = name.split(/\s+/).filter(p => p.length > 1)
  const allTerms = [name, ...parts]
  let result = text
  for (const term of allTerms) {
    result = result.replace(
      new RegExp(`${NOT_BEFORE}${escapeRe(term)}${NOT_AFTER}`, 'gi'),
      '_'.repeat(term.length)
    )
  }
  while (/(_+)\s+(_+)/.test(result)) {
    result = result.replace(/(_+)\s+(_+)/g, (_, a, b) => '_'.repeat(a.length + 1 + b.length))
  }
  return result
}

// GET /api/sop-schedule — admin list
sopScheduleRouter.get('/', (c) => {
  const rows = sqlite.prepare(`
    SELECT ss.id, ss.date, ss.footballer_id, ss.created_at,
           f.name AS footballer_name,
           SUBSTR(f.style_of_play, 1, 80) AS style_of_play_snippet
    FROM sop_schedule ss
    LEFT JOIN footballers f ON f.id = ss.footballer_id
    ORDER BY ss.date ASC
  `).all() as {
    id: number
    date: string
    footballer_id: number | null
    created_at: string
    footballer_name: string | null
    style_of_play_snippet: string | null
  }[]
  return c.json(rows)
})

// GET /api/sop-schedule/available — footballers with style_of_play, for assign modal
sopScheduleRouter.get('/available', (c) => {
  const rows = sqlite.prepare(`
    SELECT id, name, style_of_play
    FROM footballers
    WHERE style_of_play IS NOT NULL AND style_of_play != ''
    ORDER BY name ASC
  `).all() as { id: number; name: string; style_of_play: string }[]
  return c.json(rows)
})

// GET /api/sop-schedule/rounds — game rounds with blanked text
sopScheduleRouter.get('/rounds', (c) => {
  const rows = sqlite.prepare(`
    SELECT ss.date, f.id AS footballer_id, f.name AS footballer_name, f.style_of_play
    FROM sop_schedule ss
    JOIN footballers f ON f.id = ss.footballer_id
    WHERE ss.footballer_id IS NOT NULL AND f.style_of_play IS NOT NULL
    ORDER BY ss.date ASC
  `).all() as {
    date: string
    footballer_id: number
    footballer_name: string
    style_of_play: string
  }[]

  const rounds = rows.map(r => ({
    date: r.date,
    footballerId: r.footballer_id,
    footballerName: r.footballer_name,
    styleOfPlay: blankName(r.style_of_play, r.footballer_name),
    historyText: blankName(r.style_of_play, r.footballer_name).slice(0, 40),
  }))

  return c.json(rounds)
})

// PUT /api/sop-schedule/:date — upsert
sopScheduleRouter.put(
  '/:date',
  zValidator('json', z.object({ footballer_id: z.number().int() })),
  async (c) => {
    const date = c.req.param('date')
    const { footballer_id } = c.req.valid('json')

    const existing = await db.select().from(sop_schedule).where(eq(sop_schedule.date, date))

    if (existing.length > 0) {
      const [updated] = await db
        .update(sop_schedule)
        .set({ footballer_id })
        .where(eq(sop_schedule.date, date))
        .returning()
      return c.json(updated)
    } else {
      const [created] = await db
        .insert(sop_schedule)
        .values({ date, footballer_id })
        .returning()
      return c.json(created, 201)
    }
  }
)

// DELETE /api/sop-schedule — clear all
sopScheduleRouter.delete('/', async (c) => {
  await db.delete(sop_schedule)
  return c.json({ ok: true })
})

// POST /api/sop-schedule/strip-citations — one-time cleanup of existing style_of_play data
sopScheduleRouter.post('/strip-citations', async (c) => {
  const rows = await db
    .select({ id: footballers.id, style_of_play: footballers.style_of_play })
    .from(footballers)
    .where(isNotNull(footballers.style_of_play))

  let updated = 0
  for (const row of rows) {
    if (!row.style_of_play) continue
    const cleaned = row.style_of_play.replace(/\s*\[[^\]]*\]/g, '').trim()
    if (cleaned !== row.style_of_play) {
      await db.update(footballers)
        .set({ style_of_play: cleaned, updated_at: sql`(datetime('now'))` })
        .where(sql`${footballers.id} = ${row.id}`)
      updated++
    }
  }

  return c.json({ ok: true, updated, total: rows.length })
})

// DELETE /api/sop-schedule/:date
sopScheduleRouter.delete('/:date', async (c) => {
  const date = c.req.param('date')
  const [deleted] = await db
    .delete(sop_schedule)
    .where(eq(sop_schedule.date, date))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
