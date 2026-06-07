import { useNavigate, useLocation } from 'react-router'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

// Fixed bottom bar nudging signed-out visitors to create an account. Shown only
// on game routes (/play/*) and hidden once the user is signed in. (Reserved as
// the future slot for a Google ad.)
export function SignupBanner() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (loading || user) return null
  if (!location.pathname.startsWith('/play')) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-green-500 text-[#0b1020] shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
      <div className="max-w-3xl mx-auto flex items-center gap-3 px-3 py-2">
        <Sparkles size={18} className="shrink-0" />
        <p className="text-xs sm:text-sm font-semibold flex-1 leading-tight">
          Sign up free to unlock 7 more games — new ones added all the time.
        </p>
        <button
          onClick={() => navigate(`/signup?next=${encodeURIComponent(location.pathname)}`)}
          className="shrink-0 bg-[#1a1a2e] text-white text-xs sm:text-sm font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg hover:bg-[#2a2a4e] transition-colors"
        >
          Sign up
        </button>
      </div>
    </div>
  )
}
