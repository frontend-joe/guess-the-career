import { eq } from 'drizzle-orm'
import { db, sqlite, normalizeName } from '../db/client.ts'
import { footballers, career_stints } from '../db/schema.ts'
import { scrapeWikipedia, normalizeClubAlias } from './scraper.ts'
import { clubWikiUrl } from './clubs.ts'

// Shared player/club import helpers used by the Transfermarkt-scraping games
// (Transfer History has its own in-file copies; Record Signings uses these).
// Given only a scraped name (+ club hint), resolve to an existing footballer or
// search Wikipedia, scrape, and create one. Also translate long Transfermarkt club
// names to the short DB names.

const WIKI_HEADERS = { 'User-Agent': 'GuessTheCareer-Admin/1.0' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function stripDiacritics(s: string): string {
  return normalizeName(s)
}

// Edit distance with transpositions — tolerates transliteration differences.
export function damerau(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
    }
  }
  return dp[m][n]
}

// ── Club-name matching (long Transfermarkt name → short DB name) ────────────

interface ClubRow { name: string; wikipedia_url: string | null }
export type ClubMatch = ClubRow & { matched: boolean }
export type ClubMatcher = (raw: string) => ClubMatch

const GENERIC_CLUB_WORDS = new Set([
  'united', 'city', 'real', 'racing', 'sporting', 'atletico', 'deportivo', 'dynamo',
  'dinamo', 'inter', 'olympique', 'athletic', 'rovers', 'county', 'town', 'wanderers',
  'albion', 'rangers', 'nacional', 'sport', 'sports', 'union', 'junior', 'juniors',
  'club', 'clube', 'sociedade', 'esportiva', 'esporte', 'calcio', 'futebol', 'futbol',
])

function significantTokens(s: string): string[] {
  return stripDiacritics(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
}

function isReserveTeam(raw: string): boolean {
  return /\s(B|C|II|III|IV)$/.test(raw) ||
    /\bU-?\d{1,2}\b/.test(raw) ||
    /\b(reserves?|youth|amateur|academy|castilla)\b/i.test(raw)
}

export function buildClubMatcher(): ClubMatcher {
  const clubs = sqlite.prepare(`SELECT name, wikipedia_url FROM clubs`).all() as ClubRow[]
  const tokenized = clubs.map((c) => ({ c, tokens: significantTokens(c.name) }))

  return (raw: string): ClubMatch => {
    const fallback: ClubMatch = { name: raw, wikipedia_url: clubWikiUrl(raw), matched: false }

    const alias = normalizeClubAlias(raw)
    const exact = clubs.find(
      (c) => c.name.toLowerCase() === raw.toLowerCase() || c.name.toLowerCase() === alias.toLowerCase(),
    )
    if (exact) return { ...exact, matched: true }

    if (isReserveTeam(raw)) return fallback

    const rawTokens = significantTokens(raw)
    if (rawTokens.length === 0) return fallback

    const tokenPos = (dt: string): number | null => {
      let pos: number | null = null
      rawTokens.forEach((rt, i) => {
        if ((rt === dt || (dt.length >= 5 && damerau(rt, dt) <= 1)) && (pos === null || i < pos)) pos = i
      })
      return pos
    }

    let best: { c: ClubRow; count: number; pos: number } | null = null
    for (const { c, tokens } of tokenized) {
      if (tokens.length === 0) continue
      if (tokens.length === 1 && GENERIC_CLUB_WORDS.has(tokens[0])) continue
      let minPos = Infinity
      let allPresent = true
      for (const dt of tokens) {
        const p = tokenPos(dt)
        if (p === null) { allPresent = false; break }
        if (p < minPos) minPos = p
      }
      if (!allPresent) continue
      const better =
        !best ||
        tokens.length > best.count ||
        (tokens.length === best.count && minPos < best.pos) ||
        (tokens.length === best.count && minPos === best.pos &&
          (c.wikipedia_url ? 1 : 0) > (best.c.wikipedia_url ? 1 : 0)) ||
        (tokens.length === best.count && minPos === best.pos &&
          (c.wikipedia_url ? 1 : 0) === (best.c.wikipedia_url ? 1 : 0) && c.name.length < best.c.name.length)
      if (better) best = { c, count: tokens.length, pos: minPos }
    }

    return best ? { ...best.c, matched: true } : fallback
  }
}

// ── Footballer resolve-or-create ────────────────────────────────────────────

async function wikiSearch(query: string, attempt = 0): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&format=json&srlimit=5`
  let res: Response
  try {
    res = await fetch(url, { headers: WIKI_HEADERS })
  } catch {
    if (attempt < 3) { await sleep(600 * (attempt + 1)); return wikiSearch(query, attempt + 1) }
    return []
  }
  if ((res.status === 429 || res.status === 503) && attempt < 3) {
    await sleep(600 * (attempt + 1))
    return wikiSearch(query, attempt + 1)
  }
  if (!res.ok) return []
  const data = (await res.json()) as { query?: { search?: { title: string }[] } }
  return (data.query?.search ?? []).map((s) => s.title)
}

function titleMatchesName(title: string, nameParts: string[]): boolean {
  if (nameParts.length === 0) return false
  const titleTokens = stripDiacritics(title).split(/\s+/).filter(Boolean)
  const has = (p: string) =>
    titleTokens.some((t) => t === p || t.includes(p) || (p.length >= 5 && damerau(t, p) <= 1))
  const surname = nameParts[nameParts.length - 1]
  if (!titleTokens.some((t) => t.includes(surname) || (surname.length >= 5 && damerau(t, surname) <= 1)))
    return false
  return nameParts.slice(0, -1).every(has) || nameParts.length === 1
}

export function dbFootballerByName(name: string): number | null {
  const row = sqlite
    .prepare(`SELECT id FROM footballers WHERE normalize(name) = normalize(?) LIMIT 1`)
    .get(name) as { id: number } | undefined
  return row?.id ?? null
}

async function insertScrapedFootballer(wikiUrl: string): Promise<number | null> {
  const [existing] = await db
    .select({ id: footballers.id })
    .from(footballers)
    .where(eq(footballers.wikipedia_url, wikiUrl))
    .limit(1)
  if (existing) return existing.id

  const scraped = await scrapeWikipedia(wikiUrl)

  const [byScrapedUrl] = await db
    .select({ id: footballers.id })
    .from(footballers)
    .where(eq(footballers.wikipedia_url, scraped.wikipedia_url))
    .limit(1)
  if (byScrapedUrl) return byScrapedUrl.id

  const [created] = await db
    .insert(footballers)
    .values({
      name: scraped.name,
      wikipedia_url: scraped.wikipedia_url,
      nationality: scraped.nationality,
      position: scraped.position,
      all_positions: scraped.all_positions ?? null,
      born: scraped.born,
      photo_url: scraped.photo_url ?? null,
    })
    .returning()

  const seniors = scraped.stints.filter((s) => s.stint_type === 'senior')
  if (seniors.length > 0) {
    await db.insert(career_stints).values(
      seniors.map((s, i) => ({
        footballer_id: created.id,
        sort_order: i,
        years: s.years,
        club: s.club,
        club_wikipedia_url: s.club_wikipedia_url ?? null,
        apps: s.apps ?? null,
        goals: s.goals ?? null,
        stint_type: 'senior' as const,
      })),
    )
  }
  return created.id
}

export async function resolveOrCreateFootballer(
  name: string,
  clubHint: string,
): Promise<{ id: number | null; created: boolean }> {
  const existing = dbFootballerByName(name)
  if (existing) return { id: existing, created: false }

  const nameParts = stripDiacritics(name).split(/\s+/).filter((p) => p.length > 2)

  const titles: string[] = []
  for (const q of [`${name} footballer`, `${name} ${clubHint}`, name]) {
    for (const title of await wikiSearch(q)) {
      if (titleMatchesName(title, nameParts) && !titles.includes(title)) titles.push(title)
    }
    await sleep(120)
  }

  for (const title of titles.slice(0, 5)) {
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
    try {
      const id = await insertScrapedFootballer(wikiUrl)
      if (id) return { id, created: true }
    } catch {
      // try the next candidate
    }
    await sleep(250)
  }

  return { id: null, created: false }
}
