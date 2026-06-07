import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { sqlite } from '../db/client.ts'
import { requireAdmin } from '../services/auth.ts'

export const adminRouter = new Hono()

// All admin endpoints require a logged-in admin session.
adminRouter.use('*', requireAdmin)

// GET /api/admin/export-db
adminRouter.get('/export-db', (c) => {
  const footballers = sqlite.prepare('SELECT * FROM footballers ORDER BY id').all()
  const career_stints = sqlite.prepare('SELECT * FROM career_stints ORDER BY id').all()
  const days = sqlite.prepare('SELECT * FROM days ORDER BY id').all()

  return c.json({ footballers, career_stints, days })
})

// POST /api/admin/import-db
const importSchema = z.object({
  footballers: z.array(z.object({
    id: z.number(),
    name: z.string(),
    wikipedia_url: z.string(),
    nationality: z.string().nullable(),
    position: z.string().nullable(),
    born: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })),
  career_stints: z.array(z.object({
    id: z.number(),
    footballer_id: z.number(),
    sort_order: z.number(),
    years: z.string(),
    club: z.string(),
    apps: z.number().nullable(),
    goals: z.number().nullable(),
    stint_type: z.string(),
  })),
  days: z.array(z.object({
    id: z.number(),
    date: z.string(),
    footballer_id: z.number().nullable(),
    created_at: z.string(),
  })),
})

adminRouter.post(
  '/import-db',
  zValidator('json', importSchema),
  (c) => {
    const body = c.req.valid('json')

    sqlite.transaction(() => {
      sqlite.prepare('DELETE FROM days').run()
      sqlite.prepare('DELETE FROM career_stints').run()
      sqlite.prepare('DELETE FROM footballers').run()

      const insertF = sqlite.prepare(
        'INSERT INTO footballers (id, name, wikipedia_url, nationality, position, born, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      for (const f of body.footballers) {
        insertF.run(f.id, f.name, f.wikipedia_url, f.nationality, f.position, f.born, f.created_at, f.updated_at)
      }

      const insertS = sqlite.prepare(
        'INSERT INTO career_stints (id, footballer_id, sort_order, years, club, apps, goals, stint_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      for (const s of body.career_stints) {
        insertS.run(s.id, s.footballer_id, s.sort_order, s.years, s.club, s.apps, s.goals, s.stint_type)
      }

      const insertD = sqlite.prepare(
        'INSERT INTO days (id, date, footballer_id, created_at) VALUES (?, ?, ?, ?)'
      )
      for (const d of body.days) {
        insertD.run(d.id, d.date, d.footballer_id, d.created_at)
      }
    })()

    return c.json({
      ok: true,
      imported: {
        footballers: body.footballers.length,
        career_stints: body.career_stints.length,
        days: body.days.length,
      },
    })
  }
)
