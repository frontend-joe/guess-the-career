export interface FamilyInDbPair {
  aId: number
  aName: string
  bId: number
  bName: string
  relationship: string | null
}

export interface FamilyToScrape {
  relativeName: string
  relativeUrl: string
  relatedTo: { id: number; name: string; relationship: string | null }[]
}

export interface FamiliesSummary {
  inDb: FamilyInDbPair[]
  toScrape: FamilyToScrape[]
  inDbCount: number
  toScrapeCount: number
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

export const FAMILIES_SCAN_URL = '/api/football-families/scan'
