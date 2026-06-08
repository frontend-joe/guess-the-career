import { useState, useEffect } from 'react'
import { Trash2, KeyRound, Pencil, Loader2, ShieldCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { getUsers, createUser, updateUser, deleteUser, type AdminUser } from '@/api/users'

export function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  // create form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setUsers(await getUsers())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    setCreateError(null)
    try {
      await createUser({ email: email.trim(), password, is_admin: isAdmin })
      setEmail(''); setPassword(''); setIsAdmin(false)
      await load()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  async function patch(id: number, data: { email?: string; is_admin?: boolean; password?: string }) {
    setBusyId(id)
    try {
      await updateUser(id, data)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleAdmin(u: AdminUser) {
    const granting = !u.is_admin
    const isSelf = me?.id === u.id
    const msg = granting
      ? `Grant admin access to ${u.email}?`
      : isSelf
        ? `Remove admin from your own account (${u.email})? You'll lose access to the admin dashboard and will need another admin to restore it.`
        : `Remove admin access from ${u.email}?`
    if (!confirm(msg)) return
    await patch(u.id, { is_admin: granting })
  }

  function handleEditEmail(u: AdminUser) {
    const next = prompt('New email for this user:', u.email)
    if (!next || next.trim() === u.email) return
    patch(u.id, { email: next.trim() })
  }

  function handleResetPassword(u: AdminUser) {
    const pw = prompt(`Set a new password for ${u.email} (min 8 chars):`)
    if (!pw) return
    if (pw.length < 8) { alert('Password must be at least 8 characters.'); return }
    patch(u.id, { password: pw })
  }

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return
    setBusyId(u.id)
    try {
      await deleteUser(u.id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Users</h1>

      {/* Create user */}
      <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium flex items-center gap-1.5"><UserPlus className="h-4 w-4" /> Create user</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input type="email" required placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
          <Input type="text" required minLength={8} placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1" />
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="accent-primary" />
            Admin (full dashboard access)
          </label>
          <Button type="submit" size="sm" disabled={creating || !email.trim() || password.length < 8}>
            {creating ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating…</> : 'Create user'}
          </Button>
        </div>
        {createError && <p className="text-sm text-destructive">{createError}</p>}
      </form>

      {/* User list */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          All users ({users.length})
        </p>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium w-20">Admin</th>
                  <th className="text-left px-3 py-2 font-medium w-28 hidden sm:table-cell">Joined</th>
                  <th className="px-3 py-2 font-medium w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="font-medium">{u.email}</span>
                      {me?.id === u.id && <span className="ml-2 text-[10px] uppercase tracking-wide text-primary font-semibold">you</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={u.is_admin}
                        disabled={busyId === u.id}
                        onChange={() => handleToggleAdmin(u)}
                        className="accent-primary cursor-pointer"
                        title="Toggle admin"
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums hidden sm:table-cell">
                      {u.created_at?.slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit email" disabled={busyId === u.id} onClick={() => handleEditEmail(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Reset password" disabled={busyId === u.id} onClick={() => handleResetPassword(u)}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title={me?.id === u.id ? "You can't delete yourself" : 'Delete user'}
                          disabled={busyId === u.id || me?.id === u.id}
                          onClick={() => handleDelete(u)}
                        >
                          {busyId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-sm">No users yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Admins can access the dashboard and every game; non-admins are normal players.
        </p>
      </div>
    </div>
  )
}
