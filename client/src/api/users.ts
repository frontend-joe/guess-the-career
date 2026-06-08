export interface AdminUser {
  id: number
  email: string
  is_admin: boolean
  created_at: string
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`)
  return body as T
}

export function getUsers(): Promise<AdminUser[]> {
  return apiFetch('/api/users')
}

export function createUser(data: { email: string; password: string; is_admin: boolean }): Promise<AdminUser> {
  return apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateUser(
  id: number,
  data: { email?: string; is_admin?: boolean; password?: string },
): Promise<AdminUser> {
  return apiFetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteUser(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/users/${id}`, { method: 'DELETE' })
}
