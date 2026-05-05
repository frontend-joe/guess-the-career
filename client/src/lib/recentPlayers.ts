const WINDOW = 20

function getRecent(key: string): number[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}

export function getExcludeParam(key: string): string {
  return getRecent(key).join(',')
}

export function recordPlayed(key: string, ids: number[]): void {
  const prev = getRecent(key)
  const merged = [...ids, ...prev.filter(id => !ids.includes(id))]
  localStorage.setItem(key, JSON.stringify(merged.slice(0, WINDOW)))
}
