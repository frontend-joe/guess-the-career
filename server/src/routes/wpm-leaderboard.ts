import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { asc } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { wpm_leaderboard } from '../db/schema.ts'

export const wpmLeaderboardRouter = new Hono()

// GET /api/wpm-leaderboard — top 20 entries sorted by fastest time
wpmLeaderboardRouter.get('/', async (c) => {
  const rows = await db
    .select()
    .from(wpm_leaderboard)
    .orderBy(asc(wpm_leaderboard.time_ms))
    .limit(20)
  return c.json(rows)
})

// POST /api/wpm-leaderboard — submit a completed game score
wpmLeaderboardRouter.post(
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
    const [entry] = await db.insert(wpm_leaderboard).values(body).returning()
    return c.json(entry, 201)
  }
)
