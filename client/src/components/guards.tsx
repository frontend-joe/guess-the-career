import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'

function FullScreenLoading() {
  return (
    <div className="h-dvh flex items-center justify-center bg-[#1a1a2e] text-white/60 text-sm">
      Loading…
    </div>
  )
}

// Admin-only area (the dashboard at /admin). Redirects non-admins to /login.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoading />
  if (!user || !user.is_admin) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <>{children}</>
}

// Gated games: any signed-in user (or admin) may play; otherwise → /signup.
export function RequireSignup({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoading />
  if (!user) {
    return <Navigate to={`/signup?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <>{children}</>
}
