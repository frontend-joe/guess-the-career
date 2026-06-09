import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Shirt, Medal, Link2, Globe, Shield, Star, ArrowLeftRight, Banknote, Flag, Plane,
  BookOpen, Handshake, Route, TrendingUp, Footprints,
  Beer, History, Lightbulb, Sparkles, Trophy, ChevronRight, ChevronDown, ArrowRight, type LucideIcon,
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
  { name: 'Foreigners in England', pitch: 'Name the overseas players who lined up for an English club.', to: '/play/foreigners', icon: Plane },
  { name: "Ballon d'Or", pitch: 'Name every player in the running for football’s biggest prize.', to: '/play/ballon-dors', icon: Globe },
  { name: 'World Cup', pitch: 'Recall the squads that went to the World Cup.', to: '/play/world-cup', icon: Shield },
  { name: 'Club Legends', pitch: 'Name the cult heroes with 100+ appearances.', to: '/play/club-legends', icon: Star },
  { name: 'Know Your Transfers', pitch: 'Which players made that move from one club to another?', to: '/play/transfers', icon: ArrowLeftRight },
  { name: 'Style of Play', pitch: 'Guess the player from their style of play.', to: '/play/style-of-play', icon: BookOpen },
]

const BANTER_GAMES: Game[] = [
  { name: 'Clubs in Common', pitch: 'Spot the club two players both turned out for.', to: '/play/clubs-in-common', icon: Handshake },
  { name: 'Guess His Clubs', pitch: 'Name every club a mystery player turned out for.', to: '/play/guess-his-clubs', icon: Route },
  { name: 'Who Scored More', pitch: 'Two players head-to-head — who bagged more goals?', to: '/play/who-scored-more', icon: TrendingUp },
  { name: 'Who Played More', pitch: 'Two players head-to-head — who made more appearances?', to: '/play/who-played-more', icon: Footprints },
  { name: 'Know Your Club', pitch: 'Identify the club from a handful of cryptic clues.', to: '/play/know-your-club', icon: Shield },
]

const FEATURES = [
  { icon: Beer, title: 'Built for the pub', body: "Play with your mates and see whose football memory really holds up — the names people pull out are half the fun." },
  { icon: History, title: 'Pure nostalgia', body: 'Centred on the classic, mostly retired greats of roughly 1990–2010. If you grew up on this era, it hits different.' },
  { icon: Lightbulb, title: 'Clever clues', body: 'Club logos, positions, squad numbers and nationalities drip-feed just enough to jog the memory.' },
  { icon: Sparkles, title: 'Always fresh', body: 'New games and daily challenges land all the time, so there’s always another one to crack.' },
]


function btnFocus() {
  return 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c1a]'
}

export function PublicHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [heroSrc, setHeroSrc] = useState('/hero-phone.png')
  // Frost the fixed header only once the page is scrolled; at the very top it
  // stays transparent so it blends into the hero.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Featured card under the hero spotlights a random game on each load.
  const [featured] = useState<Game>(() => {
    const all = [FREE_GAME, ...GATED_GAMES, ...BANTER_GAMES]
    return all[Math.floor(Math.random() * all.length)]
  })
  const FeaturedIcon = featured.icon

  function openGame(g: Game) {
    navigate(g.to)
  }

  function scrollToGames() {
    document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' })
  }

  function renderGameCard(g: Game) {
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
          <span className="text-[10px] font-bold uppercase tracking-wide text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Free</span>
        </div>
        <h3 className="font-display text-lg tracking-tight">{g.name}</h3>
        <p className="text-white/55 text-sm mt-1.5 leading-snug">{g.pitch}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-green-400">
          Play
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </span>
      </button>
    )
  }

  return (
    <div className="min-h-dvh bg-[#0b0c1a] pitch-grid text-white font-ui overflow-x-clip selection:bg-green-400/30">
      {/* Nav */}
      <header className={`sticky top-0 z-50 transition-colors duration-300 ${scrolled ? 'backdrop-blur-md bg-[#0b0c1a]/80 divide-soft-b' : 'bg-transparent'}`}>
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
          <div className="animate-rise text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 text-green-400 text-xs font-bold uppercase tracking-[0.18em] mb-5 glass rounded-full px-3 py-1.5">
              <Trophy size={14} /> Win a FOOTBALL shirt for completing every game
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.04] tracking-tight">
              The daily football<br />
              <span className="text-green-400 text-glow">guessing games.</span>
            </h1>
            <p className="mt-5 text-white/70 text-lg max-w-md leading-relaxed mx-auto md:mx-0">
              Test your knowledge of football's golden era. Clues drip in — club badges,
              squad numbers, positions and flags — until the name clicks. Brilliant solo,
              even better down the pub with your mates.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center md:justify-start">
              <button
                onClick={scrollToGames}
                className={`bg-green-500 hover:bg-green-400 text-[#0b1020] font-bold rounded-xl px-6 py-3.5 uppercase tracking-wide text-sm flex items-center gap-2 transition-all glow-ring hover:-translate-y-0.5 cursor-pointer ${btnFocus()}`}
              >
                Explore the games <ChevronDown size={16} />
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
            <span className="absolute left-0 top-10 hidden sm:flex items-center gap-3 glass rounded-3xl px-5 py-3 text-xl font-bold shadow-xl animate-float" style={{ animationDelay: '0.8s' }}>
              <span className="text-blue-300">DF</span>
              <span className="text-gray-300">+</span>
              <NationalityFlag nationality="Argentina" className="w-8 h-6 object-cover border border-white/10" />
              <span className="text-gray-300">+</span>
              <MiniClubBadge club="Roma" wikipediaUrl="https://en.wikipedia.org/wiki/AS_Roma" size={32} />
            </span>
            <span className="absolute right-2 bottom-16 hidden sm:flex items-center gap-3 glass rounded-3xl px-5 py-3 text-xl font-bold shadow-xl animate-float" style={{ animationDelay: '1.6s' }}>
              <MiniClubBadge club="Roma" wikipediaUrl="https://en.wikipedia.org/wiki/AS_Roma" size={32} />
              <ArrowRight size={22} className="text-gray-300" />
              <MiniClubBadge club="Real Madrid" wikipediaUrl="https://en.wikipedia.org/wiki/Real_Madrid_CF" size={32} />
              <span className="text-green-400 ml-1">€51.2m</span>
            </span>
          </div>
        </div>
      </section>

      {/* Featured game — spotlights a random game on each load */}
      <section className="max-w-6xl mx-auto px-4 pb-4">
        <div className="relative rounded-4xl glass p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 overflow-hidden">
          <div className="shrink-0 w-16 h-16 rounded-2xl bg-green-500 text-[#0b1020] flex items-center justify-center glow-ring">
            <FeaturedIcon size={32} />
          </div>
          <div className="flex-1">
            <span className="text-green-400 text-xs font-bold uppercase tracking-widest">Featured game</span>
            <h2 className="font-display text-2xl mt-1.5">{featured.name}</h2>
            <p className="text-white/70 mt-1.5 max-w-xl">{featured.pitch}</p>
          </div>
          <button
            onClick={() => navigate(featured.to)}
            className={`bg-green-500 hover:bg-green-400 text-[#0b1020] font-bold rounded-xl px-6 py-3 uppercase tracking-wide text-sm whitespace-nowrap transition-colors cursor-pointer ${btnFocus()}`}
          >
            Play {featured.name}
          </button>
        </div>
      </section>

      {/* List Games */}
      <section id="games" className="max-w-6xl mx-auto px-4 pt-14 pb-6 scroll-mt-20">
        <div className="flex items-end justify-between mb-7 flex-wrap gap-2">
          <h2 className="font-display text-3xl tracking-tight">List Games</h2>
          <p className="text-white/50 text-sm">List players with your mates.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[FREE_GAME, ...GATED_GAMES].map(renderGameCard)}
        </div>
      </section>

      {/* Banter Games */}
      <section className="max-w-6xl mx-auto px-4 pt-6 pb-14">
        <div className="flex items-end justify-between mb-7 flex-wrap gap-2">
          <h2 className="font-display text-3xl tracking-tight">Banter Games</h2>
          <p className="text-white/50 text-sm">Quick-fire games to settle debates with your mates.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BANTER_GAMES.map(renderGameCard)}
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
              Complete all 16 games and you're in with a chance — we give away a classic football shirt to players who finish the lot.
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
            { n: 1, t: 'Pick a game', d: 'Every game is free to play — jump straight in, no signup required.' },
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
          <p className="text-white/70 mt-3">Every game is free. Create an account to save your scores and progress across devices.</p>
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
