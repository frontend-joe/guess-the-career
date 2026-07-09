// Global app metadata surfaced to the client.

export async function getLastRescrape(): Promise<{ lastRescrape: string | null }> {
  const res = await fetch('/api/app-meta')
  if (!res.ok) throw new Error('Failed to fetch app meta')
  return res.json()
}
