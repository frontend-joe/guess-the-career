export interface FamilyLink {
  id: number
  footballerName: string
  relativeName: string
  relativeUrl: string
  relationship: string | null
  inDb: boolean
  included: boolean
}

export interface FamiliesSummary {
  links: FamilyLink[]
  inDbCount: number
  toScrapeCount: number
  includedCount: number
}

export async function getFamiliesSummary(): Promise<FamiliesSummary> {
  const res = await fetch('/api/football-families/summary')
  if (!res.ok) throw new Error('Failed to load summary')
  return res.json()
}

export async function clearFamilies(): Promise<void> {
  const res = await fetch('/api/football-families', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear')
}

export async function setFamilyIncluded(id: number, included: boolean): Promise<void> {
  const res = await fetch('/api/football-families/include', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, included }),
  })
  if (!res.ok) throw new Error('Failed to update')
}

export async function getFamilyPlayers(): Promise<{ id: number; name: string }[]> {
  const res = await fetch('/api/football-families/players')
  if (!res.ok) throw new Error('Failed to load players')
  return res.json()
}

export interface ScanRelative {
  linkId: number
  relativeName: string
  relativeUrl: string
  relationship: string | null
  relativeFootballerId: number | null
  included: boolean
}

export interface ScanBatchPlayer {
  id: number
  name: string
  error?: string
  relatives?: ScanRelative[]
}

export async function scanFamilyBatch(ids: number[]): Promise<ScanBatchPlayer[]> {
  const res = await fetch('/api/football-families/scan-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error('Batch failed')
  return (await res.json()).results
}

export interface FamilyMember {
  footballerId: number
  name: string
  nationality: string | null
  position: string | null
  clubName: string | null
  clubWikiUrl: string | null
  years: string | null
}

export interface Family {
  relationship: string | null
  members: FamilyMember[]
}

export async function getFamilyGame(): Promise<Family[]> {
  const res = await fetch('/api/football-families/game')
  if (!res.ok) throw new Error('Failed to load game')
  return res.json()
}

export async function scrapeRelative(url: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  const res = await fetch('/api/football-families/scrape-relative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return res.json()
}
