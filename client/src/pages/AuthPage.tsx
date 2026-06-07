import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Loader2, ChevronLeft, Trophy } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isLogin = mode === 'login'
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const user = isLogin ? await login(email, password) : await signup(email, password)
      if (next) navigate(next, { replace: true })
      else navigate(user.is_admin ? '/admin' : '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const otherHref = (isLogin ? '/signup' : '/login') + (next ? `?next=${encodeURIComponent(next)}` : '')
  const inputCls =
    'bg-[#0b0c1a] text-white rounded-xl px-3.5 py-3 outline-none border border-white/10 focus:border-green-400 focus-visible:ring-2 focus-visible:ring-green-400/40 transition-colors'

  return (
    <div className="relative min-h-dvh bg-[#0b0c1a] pitch-grid text-white font-ui flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* glow blooms */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-104 h-104 rounded-full bg-green-500/15 blur-3xl animate-pulse-glow" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl" />

      <Link
        to="/"
        className="absolute top-4 left-4 text-white/50 hover:text-white flex items-center gap-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 rounded-lg px-2 py-1"
      >
        <ChevronLeft size={16} /> Home
      </Link>

      <div className="relative w-full max-w-sm animate-rise">
        <div className="text-center mb-7">
          <Link to="/" className="font-display text-2xl tracking-wide">
            GUESS THE <span className="text-green-400 text-glow">LIST</span>
          </Link>
          <p className="text-white/55 text-sm mt-2">
            {isLogin ? 'Welcome back — log in to keep playing' : 'Create your free account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-3xl p-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-white/50 uppercase tracking-widest font-semibold">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              style={{ fontSize: '16px' }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-white/50 uppercase tracking-widest font-semibold">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              style={{ fontSize: '16px' }}
            />
            {!isLogin && <span className="text-[11px] text-white/40">At least 8 characters</span>}
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 bg-green-500 hover:bg-green-400 text-[#0b1020] font-bold py-3 rounded-xl uppercase tracking-wide text-sm flex items-center justify-center gap-2 transition-all glow-ring hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c1a]"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {isLogin ? 'Log in' : 'Sign up free'}
          </button>

          {!isLogin && (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-green-400/90 font-semibold uppercase tracking-wide">
              <Trophy size={12} /> Unlock all 8 games
            </p>
          )}
        </form>

        <p className="text-white/55 text-sm text-center mt-5">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <Link to={otherHref} className="text-green-400 font-semibold hover:underline">
            {isLogin ? 'Sign up' : 'Log in'}
          </Link>
        </p>
      </div>
    </div>
  )
}
