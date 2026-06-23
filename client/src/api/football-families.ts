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

export async function getFamilyPlayers(): Promise<{ id: number; name: string }[]> {
  const res = await fetch('/api/football-families/players')
  if (!res.ok) throw new Error('Failed to load players')
  return res.json()
}

export interface ScanBatchResult { id: number; relativesFound?: number; error?: string }

export async function scanFamilyBatch(ids: number[]): Promise<ScanBatchResult[]> {
  const res = await fetch('/api/football-families/scan-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error('Batch failed')
  return (await res.json()).results
}
