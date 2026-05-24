export interface HonorPlayer {
  id: number
  name: string
  wikipedia_url: string
  photo_url: string | null
  count: number
}

export interface HonorQuestion {
  honor_key: string
  honor_label: string
  player1: HonorPlayer
  player2: HonorPlayer
}

export async function getHonorSession(exclude?: number[]): Promise<HonorQuestion[]> {
  const params = exclude && exclude.length > 0 ? `?exclude=${exclude.join(',')}` : ''
  const res = await fetch(`/api/honor-game/session${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}
