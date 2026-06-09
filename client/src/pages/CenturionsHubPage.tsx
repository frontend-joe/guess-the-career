import { useNavigate } from 'react-router'
import { Home, CheckCircle } from 'lucide-react'
import { CENTURION_MODES, loadCenturionProgress } from '@/api/centurions'

export function CenturionsHubPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-[#1a1a2e] font-sans flex flex-col w-full max-w-100 mx-auto">
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <button className="text-white/90 hover:text-green-400 transition-colors p-1" onClick={() => navigate('/')}>
          <Home size={22} />
        </button>
        <span className="text-white font-display text-sm tracking-wide uppercase">The Centurions</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 px-4 py-4 pb-8">
        <p className="text-white/40 text-xs text-center mb-4 uppercase tracking-widest">Choose a challenge</p>
        <div className="grid grid-cols-2 gap-3">
          {CENTURION_MODES.map(mode => {
            const { guessedKeys, total } = loadCenturionProgress(mode.id)
            const guessedCount = guessedKeys.length
            const complete = total > 0 && guessedCount >= total

            return (
              <button
                key={mode.id}
                onClick={() => navigate(`/play/centurions/${mode.id}`)}
                className={`relative flex flex-col items-start gap-1.5 rounded-xl px-4 py-4 border text-left transition-colors ${
                  complete
                    ? 'bg-green-500/20 border-green-500/40 hover:bg-green-500/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                {complete && (
                  <CheckCircle size={16} className="absolute top-3 right-3 text-green-400" />
                )}
                <span className={`text-xs font-bold uppercase tracking-wide leading-tight ${complete ? 'text-green-300' : 'text-white'}`}>
                  {mode.title}
                </span>
                <span className="text-white/40 text-[11px] leading-tight">{mode.subtitle}</span>
                <span className={`text-xs font-mono mt-1 ${complete ? 'text-green-400' : 'text-white/30'}`}>
                  {guessedCount} / {total > 0 ? total : '?'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
