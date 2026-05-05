import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const clubsInCommonRouter = new Hono()

function normalizeClubName(club: string): string {
  return club.replace(/^→\s*/, '').replace(/\s*\(loan\)\s*$/i, '').trim()
}

function isReserveTeam(club: string): boolean {
  return / [BC]$/.test(club) || / II$/.test(club) || club === 'Bilbao Athletic'
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Pair = {
  footballer1: { id: number; name: string; wikipedia_url: string }
  footballer2: { id: number; name: string; wikipedia_url: string }
  commonClubs: string[]
  clubWikiUrls: Record<string, string>
  required: number
}

function selectPairs(validPairs: Pair[], target: number): Pair[] {
  const multiPairs = shuffle(validPairs.filter(p => p.commonClubs.length >= 2))
  const singlePairs = shuffle(validPairs.filter(p => p.commonClubs.length === 1))

  const usedIds = new Set<number>()
  const selected: Pair[] = []

  function tryAdd(pair: Pair): boolean {
    if (usedIds.has(pair.footballer1.id) || usedIds.has(pair.footballer2.id)) return false
    selected.push(pair)
    usedIds.add(pair.footballer1.id)
    usedIds.add(pair.footballer2.id)
    return true
  }

  // Phase 1: fill up to 5 single-club pairs first to guarantee the easy rounds
  const singleTarget = Math.min(5, singlePairs.length)
  let singleUsed = 0
  for (const pair of singlePairs) {
    if (singleUsed >= singleTarget || selected.length >= target) break
    if (tryAdd(pair)) singleUsed++
  }

  // Phase 2: fill remaining slots with multi-club pairs (no repeats)
  for (const pair of multiPairs) {
    if (selected.length >= target) break
    tryAdd(pair)
  }

  // Phase 3: top up from leftover singles if multi didn't fill (no repeats)
  const usedSet = new Set(selected)
  for (const pair of singlePairs.filter(p => !usedSet.has(p))) {
    if (selected.length >= target) break
    tryAdd(pair)
  }

  // Phase 4: allow player repeats if we still can't fill (best effort)
  if (selected.length < target) {
    const usedSet2 = new Set(selected)
    for (const pair of shuffle(validPairs.filter(p => !usedSet2.has(p)))) {
      if (selected.length >= target) break
      selected.push(pair)
    }
  }

  return shuffle(selected)
}

// GET /api/clubs-in-common/session
// Returns 10 pairs of footballers that share at least 1 senior club.
// Accepts ?exclude=1,2,3 to avoid recently-seen player IDs; falls back to full pool if needed.
clubsInCommonRouter.get('/session', (c) => {
  const excludeIds = new Set(
    (c.req.query('exclude') ?? '').split(',').map(Number).filter(n => n > 0)
  )
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
    SELECT footballer_id, club, club_wikipedia_url
    FROM career_stints
    WHERE footballer_id IN (${placeholders})
      AND stint_type = 'senior'
    ORDER BY footballer_id, sort_order
  `).all(...footballerIds) as { footballer_id: number; club: string; club_wikipedia_url: string | null }[]

  // Build normalised club set per footballer, preserving original casing + wiki URL of first occurrence
  const clubMap = new Map<number, { canonical: Map<string, { name: string; url: string | null }> }>()
  for (const f of footballers) {
    clubMap.set(f.id, { canonical: new Map() })
  }
  for (const stint of stints) {
    const entry = clubMap.get(stint.footballer_id)
    if (!entry) continue
    const normalised = normalizeClubName(stint.club)
    if (isReserveTeam(normalised)) continue
    const key = normalised.toLowerCase()
    if (!entry.canonical.has(key)) {
      entry.canonical.set(key, { name: normalised, url: stint.club_wikipedia_url })
    }
  }

  // Find all valid pairs with ≥ 1 common club
  const validPairs: Pair[] = []

  for (let i = 0; i < footballers.length; i++) {
    for (let j = i + 1; j < footballers.length; j++) {
      const f1 = footballers[i]
      const f2 = footballers[j]
      const clubs1 = clubMap.get(f1.id)!.canonical
      const clubs2 = clubMap.get(f2.id)!.canonical

      const common: string[] = []
      const wikiUrls: Record<string, string> = {}
      for (const [key, { name, url }] of clubs1) {
        if (clubs2.has(key)) {
          common.push(name)
          const resolvedUrl = url ?? clubs2.get(key)!.url
          if (resolvedUrl) wikiUrls[key] = resolvedUrl
        }
      }

      if (common.length >= 1) {
        validPairs.push({
          footballer1: f1,
          footballer2: f2,
          commonClubs: common,
          clubWikiUrls: wikiUrls,
          required: common.length,
        })
      }
    }
  }

  if (validPairs.length < 10) {
    return c.json({ error: 'Not enough eligible footballer pairs' }, 422)
  }

  const preferredPairs = excludeIds.size > 0
    ? validPairs.filter(p => !excludeIds.has(p.footballer1.id) && !excludeIds.has(p.footballer2.id))
    : validPairs

  const selected = selectPairs(preferredPairs.length >= 10 ? preferredPairs : validPairs, 10)
  return c.json(selected)
})
