import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const clubsInCommonRouter = new Hono()

function normalizeClubName(club: string): string {
  return club.replace(/^→\s*/, '').replace(/\s*\(loan\)\s*$/i, '').trim()
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// GET /api/clubs-in-common/session
// Returns 10 pairs of footballers that share at least 1 senior club
clubsInCommonRouter.get('/session', (c) => {
  const footballers = sqlite.prepare(`
    SELECT f.id, f.name, f.wikipedia_url
    FROM footballers f
    WHERE EXISTS (
      SELECT 1 FROM career_stints cs
      WHERE cs.footballer_id = f.id AND cs.stint_type = 'senior'
    )
  `).all() as { id: number; name: string; wikipedia_url: string }[]

  if (footballers.length < 2) {
    return c.json({ error: 'Not enough footballers' }, 422)
  }

  const footballerIds = footballers.map(f => f.id)
  const placeholders = footballerIds.map(() => '?').join(', ')

  const stints = sqlite.prepare(`
    SELECT footballer_id, club
    FROM career_stints
    WHERE footballer_id IN (${placeholders})
      AND stint_type = 'senior'
    ORDER BY footballer_id, sort_order
  `).all(...footballerIds) as { footballer_id: number; club: string }[]

  // Build normalised club set per footballer, preserving original casing of first occurrence
  const clubMap = new Map<number, { canonical: Map<string, string> }>()
  for (const f of footballers) {
    clubMap.set(f.id, { canonical: new Map() })
  }
  for (const stint of stints) {
    const entry = clubMap.get(stint.footballer_id)
    if (!entry) continue
    const normalised = normalizeClubName(stint.club)
    const key = normalised.toLowerCase()
    if (!entry.canonical.has(key)) {
      entry.canonical.set(key, normalised)
    }
  }

  // Find all valid pairs with ≥ 1 common club
  type Pair = {
    footballer1: { id: number; name: string; wikipedia_url: string }
    footballer2: { id: number; name: string; wikipedia_url: string }
    commonClubs: string[]
    required: number
  }

  const validPairs: Pair[] = []

  for (let i = 0; i < footballers.length; i++) {
    for (let j = i + 1; j < footballers.length; j++) {
      const f1 = footballers[i]
      const f2 = footballers[j]
      const clubs1 = clubMap.get(f1.id)!.canonical
      const clubs2 = clubMap.get(f2.id)!.canonical

      const common: string[] = []
      for (const [key, name] of clubs1) {
        if (clubs2.has(key)) common.push(name)
      }

      if (common.length >= 1) {
        validPairs.push({
          footballer1: f1,
          footballer2: f2,
          commonClubs: common,
          required: common.length,
        })
      }
    }
  }

  if (validPairs.length < 10) {
    return c.json({ error: 'Not enough eligible footballer pairs' }, 422)
  }

  const selected = shuffle(validPairs).slice(0, 10)
  return c.json(selected)
})
