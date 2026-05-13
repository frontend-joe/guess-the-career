import { useNavigate } from 'react-router'
import { Users, Trophy, Handshake, TrendingUp, Footprints, Shirt, Shield, Link2, Medal, MapPin } from 'lucide-react'

export function PlayHubPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-[#1a1a2e] px-4 py-8 font-sans flex flex-col items-center">
      <h1 className="text-white font-bold text-base tracking-[0.2em] uppercase mb-6">
        Football Guessing Games
      </h1>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
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
        <button
          onClick={() => navigate('/play/who-scored-more')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <TrendingUp size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Who Scored More?</span>
          <span className="text-gray-400 text-xs">Higher or lower career goals</span>
        </button>
        <button
          onClick={() => navigate('/play/who-played-more')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Footprints size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Who Played More?</span>
          <span className="text-gray-400 text-xs">More appearances for the same club</span>
        </button>
        <button
          onClick={() => navigate('/play/guess-the-xi')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Shirt size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Guess The Eleven</span>
          <span className="text-gray-400 text-xs">Name the starting XI</span>
        </button>
        <button
          onClick={() => navigate('/play/know-your-club')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Shield size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Know Your Club</span>
          <span className="text-gray-400 text-xs">Do you know your players?</span>
        </button>
        <button
          onClick={() => navigate('/play/two-clubs')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Link2 size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Two Clubs</span>
          <span className="text-gray-400 text-xs">5 players, 2 clubs</span>
        </button>
        <button
          onClick={() => navigate('/play/top-scorers')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Medal size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Top Scorers</span>
          <span className="text-gray-400 text-xs">Guess the top scorers</span>
        </button>
        <button
          onClick={() => navigate('/play/position-knowledge')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <MapPin size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Position Knowledge</span>
          <span className="text-gray-400 text-xs">Name players by nation &amp; position</span>
        </button>
      </div>
    </div>
  )
}
