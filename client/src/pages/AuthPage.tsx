import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Loader2, ChevronLeft } from 'lucide-react'
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

  return (
    <div className="min-h-dvh bg-[#1a1a2e] flex flex-col items-center justify-center px-4 font-sans">
      <Link to="/" className="absolute top-4 left-4 text-white/50 hover:text-white flex items-center gap-1 text-sm">
        <ChevronLeft size={16} /> Home
      </Link>

      <div className="w-full max-w-sm">
        <h1 className="text-white font-bold text-xl tracking-[0.15em] uppercase text-center">
          Guess the List
        </h1>
        <p className="text-gray-400 text-sm text-center mt-1 mb-8">
          {isLogin ? 'Welcome back' : 'Create your free account'}
        </p>

        <form onSubmit={handleSubmit} className="bg-[#2a2a4e] rounded-2xl border border-white/10 p-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#1a1a2e] text-white rounded-lg px-3 py-2.5 outline-none border border-white/10 focus:border-green-400"
              style={{ fontSize: '16px' }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#1a1a2e] text-white rounded-lg px-3 py-2.5 outline-none border border-white/10 focus:border-green-400"
              style={{ fontSize: '16px' }}
            />
            {!isLogin && <span className="text-[11px] text-gray-500">At least 8 characters</span>}
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="bg-green-500 hover:bg-green-400 text-[#0b1020] font-bold py-2.5 rounded-lg uppercase tracking-wide text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {isLogin ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <p className="text-gray-400 text-sm text-center mt-5">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <Link to={otherHref} className="text-green-400 font-semibold hover:underline">
            {isLogin ? 'Sign up' : 'Log in'}
          </Link>
        </p>
      </div>
    </div>
  )
}
