import { useNavigate } from 'react-router'
import { Users, Trophy, Handshake } from 'lucide-react'

export function PlayHubPage() {
  const navigate = useNavigate()

  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-[#1a1a2e] px-4 gap-6 font-sans">
      <h1 className="text-white font-bold text-base tracking-[0.2em] uppercase mb-2">
        Football Guessing Games
      </h1>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => navigate('/play/guess-the-career')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Users size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Guess the Career</span>
          <span className="text-gray-400 text-xs">Who played where?</span>
        </button>
        <button
          onClick={() => navigate('/play/guess-his-clubs')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Trophy size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Guess His Clubs</span>
          <span className="text-gray-400 text-xs">Name the clubs they played for</span>
        </button>
        <button
          onClick={() => navigate('/play/clubs-in-common')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Handshake size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Clubs In Common</span>
          <span className="text-gray-400 text-xs">What clubs did they share?</span>
        </button>
      </div>
    </div>
  )
}
