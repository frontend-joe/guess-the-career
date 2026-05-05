import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { asc } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { wsm_leaderboard } from '../db/schema.ts'

export const wsmLeaderboardRouter = new Hono()

// GET /api/wsm-leaderboard — top 20 entries sorted by fastest time
wsmLeaderboardRouter.get('/', async (c) => {
  const rows = await db
    .select()
    .from(wsm_leaderboard)
    .orderBy(asc(wsm_leaderboard.time_ms))
    .limit(20)
  return c.json(rows)
})

// POST /api/wsm-leaderboard — submit a completed game score
wsmLeaderboardRouter.post(
  '/',
  zValidator(
    'json',
    z.object({
      player_name: z.string().min(1).max(50),
      time_ms: z.number().int().positive(),
    })
  ),
  async (c) => {
    const body = c.req.valid('json')
    const [entry] = await db.insert(wsm_leaderboard).values(body).returning()
    return c.json(entry, 201)
  }
)
