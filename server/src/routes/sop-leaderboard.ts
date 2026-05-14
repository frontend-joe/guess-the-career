import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { desc } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { sop_leaderboard } from '../db/schema.ts'

export const sopLeaderboardRouter = new Hono()

// GET /api/sop-leaderboard
sopLeaderboardRouter.get('/', async (c) => {
  const rows = await db
    .select()
    .from(sop_leaderboard)
    .orderBy(desc(sop_leaderboard.score), sop_leaderboard.created_at)
    .limit(20)
  return c.json(rows)
})

// POST /api/sop-leaderboard
sopLeaderboardRouter.post(
  '/',
  zValidator('json', z.object({
    player_name: z.string().min(1).max(50),
    score: z.number().int().min(0),
    total: z.number().int().positive(),
  })),
  async (c) => {
    const body = c.req.valid('json')
    const [entry] = await db.insert(sop_leaderboard).values(body).returning()
    return c.json(entry, 201)
  }
)
