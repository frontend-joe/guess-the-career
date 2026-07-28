import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sqlite } from '../db/client.ts'
import { getCurrentUser } from '../services/auth.ts'

export const progressRouter = new Hono()

// GET /api/progress — all of the current user's game-progress blobs, keyed by the
// localStorage game key: { [game_key]: <parsed JSON> }.
progressRouter.get('/', async (c) => {
  const user = await getCurrentUser(c)
  if (!user) return c.json({ error: 'Not authenticated' }, 401)

  const rows = sqlite
    .prepare(`SELECT game_key, data FROM user_game_progress WHERE user_id = ?`)
    .all(user.id) as { game_key: string; data: string }[]

  const out: Record<string, unknown> = {}
  for (const r of rows) {
    try {
      out[r.game_key] = JSON.parse(r.data)
    } catch {
      // skip corrupt blobs
    }
  }
  return c.json(out)
})

// PUT /api/progress — upsert one or more { game_key: data } blobs for the user.
// Used for the initial bulk upload and for ongoing single-key pushes.
progressRouter.put(
  '/',
  zValidator('json', z.record(z.string().min(1).max(160), z.unknown()).refine((o) => Object.keys(o).length <= 300, 'too many keys')),
  async (c) => {
    const user = await getCurrentUser(c)
    if (!user) return c.json({ error: 'Not authenticated' }, 401)

    const body = c.req.valid('json')
    const upsert = sqlite.prepare(
      `INSERT INTO user_game_progress (user_id, game_key, data)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, game_key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
    )
    const tx = sqlite.transaction((entries: [string, unknown][]) => {
      for (const [key, value] of entries) {
        const data = JSON.stringify(value)
        if (data.length > 200_000) continue // guard against oversized blobs
        upsert.run(user.id, key, data)
      }
    })
    tx(Object.entries(body))
    return c.json({ ok: true })
  },
)
