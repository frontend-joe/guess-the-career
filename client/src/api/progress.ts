// Account-synced game progress. All calls send the session cookie.

export async function getProgress(): Promise<Record<string, unknown>> {
  const res = await fetch('/api/progress', { credentials: 'include' })
  if (!res.ok) throw new Error(`progress fetch failed: ${res.status}`)
  return res.json()
}

export async function putProgress(
  map: Record<string, unknown>,
  opts?: { keepalive?: boolean },
): Promise<void> {
  if (Object.keys(map).length === 0) return
  const res = await fetch('/api/progress', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(map),
    keepalive: opts?.keepalive,
  })
  if (!res.ok) throw new Error(`progress put failed: ${res.status}`)
}
