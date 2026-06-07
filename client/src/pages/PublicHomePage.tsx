import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Shirt, Medal, Link2, Globe, Shield, Star, ArrowLeftRight, Banknote, Flag,
  Lock, Beer, History, Lightbulb, Sparkles, Trophy, ChevronRight, ArrowRight, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { NationalityFlag } from '@/components/NationalityFlag'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import heroFallback from '@/assets/hero.png'

interface Game {
  name: string
  pitch: string
  to: string
  icon: LucideIcon
  free?: boolean
}

const FREE_GAME: Game = {
  name: 'Guess the XI',
  pitch: 'Name every player in a classic starting line-up from club badges, shirt numbers, positions and flags.',
  to: '/play/guess-the-xi',
  icon: Shirt,
  free: true,
}

const GATED_GAMES: Game[] = [
  { name: 'Top Scorers', pitch: "Guess a competition's leading marksmen.", to: '/play/top-scorers', icon: Medal },
  { name: 'Two Clubs', pitch: 'Five players, two clubs — name who turned out for both.', to: '/play/two-clubs', icon: Link2 },
  { name: 'Transfer History', pitch: "Name the season's biggest transfers from the fee and the badges.", to: '/play/transfer-history', icon: Banknote },
  { name: 'Nationality Players', pitch: 'A flag and a club — name the players who are both.', to: '/play/nationality-players', icon: Flag },
  { name: "Ballon d'Or", pitch: 'Name every player in the running for football’s biggest prize.', to: '/play/ballon-dors', icon: Globe },
  { name: 'World Cup', pitch: 'Recall the squads that went to the World Cup.', to: '/play/world-cup', icon: Shield },
  { name: 'Club Legends', pitch: 'Name the cult heroes with 100+ appearances.', to: '/play/club-legends', icon: Star },
  { name: 'Know Your Transfers', pitch: 'Which players made that move from one club to another?', to: '/play/transfers', icon: ArrowLeftRight },
]

const FEATURES = [
  { icon: Beer, title: 'Built for the pub', body: "Play with your mates and see whose football memory really holds up — the names people pull out are half the fun." },
  { icon: History, title: 'Pure nostalgia', body: 'Centred on the classic, mostly retired greats of roughly 1990–2010. If you grew up on this era, it hits different.' },
  { icon: Lightbulb, title: 'Clever clues', body: 'Club logos, positions, squad numbers and nationalities drip-feed just enough to jog the memory.' },
  { icon: Sparkles, title: 'Always fresh', body: 'New games and daily challenges land all the time, so there’s always another one to crack.' },
]

const STATS = [
  { value: '9', label: 'games' },
  { value: 'New', label: 'daily' },
  { value: 'Free', label: 'to start' },
]

function btnFocus() {
  return 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c1a]'
}

export function PublicHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [heroSrc, setHeroSrc] = useState('/hero-phone.png')

  function openGame(g: Game) {
    if (g.free || user) navigate(g.to)
    else navigate('/signup')
  }

  return (
    <div className="min-h-dvh bg-[#0b0c1a] pitch-grid text-white font-ui overflow-x-hidden selection:bg-green-400/30">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#0b0c1a]/80 divide-soft-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <span className="font-display text-base sm:text-lg tracking-wide">
            GUESS THE <span className="text-green-400 text-glow">LIST</span>
          </span>
          <nav className="flex items-center gap-1 sm:gap-2 text-sm">
            <Link to="/play/guess-the-xi" className={`hidden sm:inline text-white/80 hover:text-white font-medium px-3 py-2 rounded-lg ${btnFocus()}`}>Play free</Link>
            {user ? (
              <>
                {user.is_admin && (
                  <Link to="/admin" className={`text-white/80 hover:text-white font-medium px-3 py-2 rounded-lg ${btnFocus()}`}>Admin</Link>
                )}
                <span className="hidden md:inline text-white/40 text-xs px-2">{user.email}</span>
              </>
            ) : (
              <>
                <Link to="/login" className={`text-white/80 hover:text-white font-medium px-3 py-2 rounded-lg ${btnFocus()}`}>Log in</Link>
                <Link to="/signup" className={`bg-green-500 hover:bg-green-400 text-[#0b1020] font-bold rounded-lg px-4 py-2 uppercase tracking-wide text-xs transition-colors ${btnFocus()}`}>
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        {/* glow blooms */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-green-500/15 blur-3xl animate-pulse-glow" />
        <div className="pointer-events-none absolute top-32 -right-32 w-[26rem] h-[26rem] rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 pt-12 sm:pt-16 pb-16 grid md:grid-cols-2 gap-10 lg:gap-6 items-center">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-1.5 text-green-400 text-xs font-bold uppercase tracking-[0.18em] mb-5 glass rounded-full px-3 py-1.5">
              <Trophy size={14} /> Win a shirt for completing every game
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.04] tracking-tight">
              The daily football<br />
              <span className="text-green-400 text-glow">guessing games.</span>
            </h1>
            <p className="mt-5 text-white/70 text-lg max-w-md leading-relaxed">
              Test your knowledge of football's golden era. Clues drip in — club badges,
              squad numbers, positions and flags — until the name clicks. Brilliant solo,
              even better down the pub with your mates.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/play/guess-the-xi')}
                className={`bg-green-500 hover:bg-green-400 text-[#0b1020] font-bold rounded-xl px-6 py-3.5 uppercase tracking-wide text-sm flex items-center gap-2 transition-all glow-ring hover:-translate-y-0.5 cursor-pointer ${btnFocus()}`}
              >
                Play Guess the XI — free <ChevronRight size={16} />
              </button>
              {!user && (
                <button
                  onClick={() => navigate('/signup')}
                  className={`border border-white/20 hover:border-green-400/60 hover:bg-white/5 text-white font-bold rounded-xl px-6 py-3.5 uppercase tracking-wide text-sm transition-colors cursor-pointer ${btnFocus()}`}
                >
                  Sign up free
                </button>
              )}
            </div>

            {/* stats */}
            <div className="mt-9 flex items-center gap-6">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-2xl text-green-400">{s.value}</div>
                  <div className="text-white/45 text-xs uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="relative flex justify-center">
            <div className="pointer-events-none absolute inset-0 m-auto w-72 h-72 rounded-full bg-green-500/25 blur-3xl" />
            <img
              src={heroSrc}
              onError={() => setHeroSrc(heroFallback)}
              alt="Playing Guess the XI on a phone — a Champions League 2005 Liverpool line-up with positional, flag and squad-number clues"
              className="relative w-64 sm:w-72 lg:w-80 drop-shadow-2xl animate-float"
            />
            {/* floating clue chips */}
            <span className="absolute left-0 top-10 hidden sm:flex items-center gap-1.5 glass rounded-2xl px-2.5 py-1.5 text-xs font-bold shadow-xl animate-float" style={{ animationDelay: '0.8s' }}>
              <span className="text-blue-300">DF</span>
              <span className="text-gray-300">+</span>
              <NationalityFlag nationality="Argentina" className="w-4 h-3.5 object-cover border border-white/10" />
              <span className="text-gray-300">+</span>
              <MiniClubBadge club="Roma" wikipediaUrl="https://en.wikipedia.org/wiki/AS_Roma" size={16} />
            </span>
            <span className="absolute right-2 bottom-16 hidden sm:flex items-center gap-1.5 glass rounded-2xl px-2.5 py-1.5 text-xs font-bold shadow-xl animate-float" style={{ animationDelay: '1.6s' }}>
              <MiniClubBadge club="Roma" wikipediaUrl="https://en.wikipedia.org/wiki/AS_Roma" size={16} />
              <ArrowRight size={11} className="text-gray-300" />
              <MiniClubBadge club="Real Madrid" wikipediaUrl="https://en.wikipedia.org/wiki/Real_Madrid_CF" size={16} />
              <span className="text-green-400 ml-0.5">€51.2m</span>
            </span>
          </div>
        </div>
      </section>

      {/* Featured free game */}
      <section className="max-w-6xl mx-auto px-4 pb-4">
        <div className="relative rounded-4xl glass p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 overflow-hidden">
          <div className="shrink-0 w-16 h-16 rounded-2xl bg-green-500 text-[#0b1020] flex items-center justify-center glow-ring">
            <Shirt size={32} />
          </div>
          <div className="flex-1">
            <span className="text-green-400 text-xs font-bold uppercase tracking-widest">Free · no signup</span>
            <h2 className="font-display text-2xl mt-1.5">Start with Guess the XI</h2>
            <p className="text-white/70 mt-1.5 max-w-xl">{FREE_GAME.pitch}</p>
          </div>
          <button
            onClick={() => navigate('/play/guess-the-xi')}
            className={`bg-green-500 hover:bg-green-400 text-[#0b1020] font-bold rounded-xl px-6 py-3 uppercase tracking-wide text-sm whitespace-nowrap transition-colors cursor-pointer ${btnFocus()}`}
          >
            Play now
          </button>
        </div>
      </section>

      {/* Games showcase */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="flex items-end justify-between mb-7 flex-wrap gap-2">
          <h2 className="font-display text-3xl tracking-tight">The games</h2>
          {!user && <p className="text-white/50 text-sm">Sign up free to unlock all of them.</p>}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[FREE_GAME, ...GATED_GAMES].map((g) => {
            const locked = !g.free && !user
            const Icon = g.icon
            return (
              <button
                key={g.name}
                onClick={() => openGame(g)}
                className={`group text-left relative glass glass-hover rounded-3xl p-5 hover:-translate-y-1 cursor-pointer ${btnFocus()}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-green-400/10 flex items-center justify-center text-green-400 group-hover:bg-green-400/20 transition-colors">
                    <Icon size={22} />
                  </div>
                  {g.free ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Free</span>
                  ) : locked ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/45 bg-white/5 px-2 py-1 rounded-full">
                      <Lock size={11} /> Locked
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-green-400/80 bg-green-400/10 px-2 py-1 rounded-full">Unlocked</span>
                  )}
                </div>
                <h3 className="font-display text-lg tracking-tight">{g.name}</h3>
                <p className="text-white/55 text-sm mt-1.5 leading-snug">{g.pitch}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-green-400">
                  {g.free ? 'Play free' : locked ? 'Sign up to unlock' : 'Play'}
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Why you'll love it */}
      <section className="divide-soft-y">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <h2 className="font-display text-3xl tracking-tight text-center">Why you'll love it</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-9">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="glass glass-hover rounded-3xl p-5">
                  <div className="w-11 h-11 rounded-xl bg-green-500/15 text-green-400 flex items-center justify-center mb-3">
                    <Icon size={22} />
                  </div>
                  <h3 className="font-display text-base tracking-tight">{f.title}</h3>
                  <p className="text-white/55 text-sm mt-1.5 leading-snug">{f.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Monthly prize */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="relative overflow-hidden rounded-4xl bg-linear-to-r from-green-500 to-emerald-400 text-[#0b1020] p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/20 blur-2xl" />
          <Trophy size={48} className="shrink-0 relative" />
          <div className="flex-1 relative">
            <h2 className="font-display text-2xl sm:text-3xl">Win a football shirt</h2>
            <p className="font-medium mt-1.5 opacity-90">
              Complete all 9 games and you're in with a chance — we give away a classic football shirt to players who finish the lot.
            </p>
          </div>
          {!user && (
            <button
              onClick={() => navigate('/signup')}
              className={`relative bg-[#0b1020] text-white font-bold rounded-xl px-6 py-3 uppercase tracking-wide text-sm whitespace-nowrap hover:bg-[#1a1a2e] transition-colors cursor-pointer ${btnFocus()}`}
            >
              Sign up free
            </button>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="font-display text-3xl tracking-tight text-center mb-9">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            { n: 1, t: 'Pick a game', d: 'Start free with Guess the XI, or sign up to unlock the full set.' },
            { n: 2, t: 'Read the clues', d: 'Badges, numbers, positions and flags point you towards the answer.' },
            { n: 3, t: 'Name the players', d: 'Type your guesses, rack up your score, then challenge your mates.' },
          ].map((s) => (
            <div key={s.n} className="glass rounded-3xl p-6">
              <div className="font-display w-10 h-10 rounded-full bg-green-500 text-[#0b1020] flex items-center justify-center mb-4 glow-ring">{s.n}</div>
              <h3 className="font-display text-lg tracking-tight">{s.t}</h3>
              <p className="text-white/55 text-sm mt-1.5">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      {!user && (
        <section className="relative max-w-3xl mx-auto px-4 pb-20 text-center">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight">Ready to play?</h2>
          <p className="text-white/70 mt-3">Create a free account and unlock all 9 games in seconds.</p>
          <button
            onClick={() => navigate('/signup')}
            className={`mt-7 bg-green-500 hover:bg-green-400 text-[#0b1020] font-bold rounded-xl px-8 py-4 uppercase tracking-wide text-sm glow-ring hover:-translate-y-0.5 transition-all cursor-pointer ${btnFocus()}`}
          >
            Sign up free
          </button>
        </section>
      )}

      {/* Footer */}
      <footer className="divide-soft-t">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-white/40">
          <span className="font-display tracking-wide text-white/70">
            GUESS THE <span className="text-green-400">LIST</span>
          </span>
          <span>© {new Date().getFullYear()} guessthelist.xyz</span>
        </div>
      </footer>
    </div>
  )
}
