export interface KitQuestion {
  slug: string
  squad_number: number
  club_at_time: string
  footballer_id: number
  footballer_name: string
  photo_url: string | null
  home_body: string
  home_leftarm: string | null
  home_rightarm: string | null
  home_shorts: string | null
  home_socks: string | null
  home_pattern: string | null
  number_colour: string | null
}

export async function getKitQuestion(exclude?: number[]): Promise<KitQuestion | null> {
  const params = new URLSearchParams()
  if (exclude && exclude.length > 0) params.set('exclude', exclude.join(','))
  const res = await fetch(`/api/kit-game/question?${params}`)
  if (!res.ok) throw new Error(`Failed to fetch kit question: ${res.status}`)
  return res.json()
}
