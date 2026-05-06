import { useState, useEffect, useRef, useCallback } from 'react'
import { Home, ChevronRight, X } from 'lucide-react'
import { getXiSession, type XiRound, type XiRoundPlayer } from '@/api/guess-the-xi'
import { getFootballers, type Footballer } from '@/api/footballers'

type RoundState = 'playing' | 'cleared' | 'given_up'

interface RoundResult {
  matchId: number
  matchName: string
  team: string
  year: number
  competition: string
  homeTeam: string
  awayTeam: string
  teamWikipediaUrl: string | null
  players: XiRoundPlayer[]
  playerNames: string[]
  guessedIndices: Set<number>
  state: RoundState
}

const COMPETITION_ABBR: Record<string, string> = {
  'UEFA Champions League': 'Champions League',
  'UEFA Europa League': 'UEL',
  'UEFA Cup': 'UEFA Cup',
  'UEFA Conference League': 'UECL',
  'FIFA World Cup': 'World Cup',
  'UEFA European Championship': 'Euros',
  'FA Cup': 'FA Cup',
  'Premier League': 'PL',
  'La Liga': 'La Liga',
  'Serie A': 'Serie A',
  'Bundesliga': 'Bundesliga',
  'Ligue 1': 'Ligue 1',
}

function abbreviateCompetition(competition: string): string {
  return COMPETITION_ABBR[competition] ?? competition
}

const POSITION_COLORS: Record<string, string> = {
  GK: 'bg-purple-100 text-purple-700',
  DF: 'bg-blue-100 text-blue-700',
  MF: 'bg-green-100 text-green-700',
  FW: 'bg-orange-100 text-orange-700',
}

const NATIONALITY_ISO: Record<string, string> = {
  'England': 'GB', 'Scotland': 'GB', 'Wales': 'GB', 'Northern Ireland': 'GB',
  'Brazil': 'BR', 'Argentina': 'AR', 'France': 'FR', 'Germany': 'DE',
  'Italy': 'IT', 'Spain': 'ES', 'Portugal': 'PT', 'Netherlands': 'NL',
  'Belgium': 'BE', 'Croatia': 'HR', 'Uruguay': 'UY', 'Colombia': 'CO',
  'Chile': 'CL', 'Mexico': 'MX', 'United States': 'US', 'Canada': 'CA',
  'Morocco': 'MA', 'Algeria': 'DZ', 'Nigeria': 'NG', 'Senegal': 'SN',
  'Ghana': 'GH', 'Ivory Coast': 'CI', 'Cameroon': 'CM', 'South Africa': 'ZA',
  'Australia': 'AU', 'Japan': 'JP', 'South Korea': 'KR',
  'Saudi Arabia': 'SA', 'Turkey': 'TR', 'Russia': 'RU', 'Ukraine': 'UA',
  'Poland': 'PL', 'Czech Republic': 'CZ', 'Austria': 'AT', 'Switzerland': 'CH',
  'Sweden': 'SE', 'Norway': 'NO', 'Denmark': 'DK', 'Finland': 'FI',
  'Iceland': 'IS', 'Serbia': 'RS', 'Greece': 'GR', 'Romania': 'RO',
  'Hungary': 'HU', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Ireland': 'IE',
  'Ecuador': 'EC', 'Paraguay': 'PY', 'Bolivia': 'BO', 'Venezuela': 'VE',
  'Peru': 'PE', 'Costa Rica': 'CR', 'Panama': 'PA', 'Honduras': 'HN',
  'Jamaica': 'JM', 'Albania': 'AL', 'North Macedonia': 'MK',
  'Bosnia and Herzegovina': 'BA', 'Montenegro': 'ME', 'Bulgaria': 'BG',
  'Georgia': 'GE', 'Armenia': 'AM', 'Azerbaijan': 'AZ',
  'Israel': 'IL', 'Iran': 'IR', 'Iraq': 'IQ',
}

function nationalityToFlag(nationality: string | null): string {
  if (!nationality) return ''
  const iso = NATIONALITY_ISO[nationality]
  if (!iso) return ''
  const offset = 0x1F1E6 - 65
  return [...iso].map(c => String.fromCodePoint(c.charCodeAt(0) + offset)).join('')
}

function normalizeGuess(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function matchesPlayer(guess: string, playerName: string): boolean {
  const g = normalizeGuess(guess)
  const p = normalizeGuess(playerName)
  if (g === p) return true
  // Last-name-only match (min 4 chars to avoid false positives on short particles)
  const lastName = p.split(' ').at(-1) ?? ''
  return lastName.length >= 4 && g === lastName
}

export function GuessTheXiPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rounds, setRounds] = useState<RoundResult[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Footballer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showFinalScore, setShowFinalScore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function buildRounds(data: XiRound[]): RoundResult[] {
    return data.map(r => ({
      matchId: r.matchId,
      matchName: r.matchName,
      team: r.team,
      year: r.year,
      competition: r.competition,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      teamWikipediaUrl: r.teamWikipediaUrl,
      players: r.players,
      playerNames: r.playerNames,
      guessedIndices: new Set<number>(),
      state: 'playing' as RoundState,
    }))
  }

  function loadSession() {
    setLoading(true)
    setError(null)
    setRoundIndex(0)
    setRounds([])
    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)
    setShowFinalScore(false)
    getXiSession()
      .then(data => setRounds(buildRounds(data)))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load session. Please try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSession() }, [])

  useEffect(() => {
    if (!loading && !error && !showFinalScore) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [roundIndex, loading, error, showFinalScore])

  const fetchSuggestions = useCallback((term: string) => {
    if (term.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    getFootballers({ search: term }).then(results => {
      setSuggestions(results.slice(0, 8))
      setShowDropdown(results.length > 0)
    }).catch(() => {})
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 200)
  }

  function handleGuess(name: string) {
    const round = rounds[roundIndex]
    if (!round || round.state !== 'playing') return

    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)

    const matched: number[] = []
    round.playerNames.forEach((pName, i) => {
      if (!round.guessedIndices.has(i) && matchesPlayer(name, pName)) {
        matched.push(i)
      }
    })

    if (matched.length === 0) {
      inputRef.current?.focus()
      return
    }

    const newGuessed = new Set(round.guessedIndices)
    matched.forEach(i => newGuessed.add(i))
    const allGuessed = newGuessed.size === round.players.length
    const updated = [...rounds]
    updated[roundIndex] = {
      ...round,
      guessedIndices: newGuessed,
      state: allGuessed ? 'cleared' : 'playing',
    }
    setRounds(updated)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleGuess(inputValue.trim())
    }
    if (e.key === 'Escape') {
      setSuggestions([])
      setShowDropdown(false)
    }
  }

  function handleGiveUp() {
    const round = rounds[roundIndex]
    if (!round || round.state !== 'playing') return
    const updated = [...rounds]
    updated[roundIndex] = { ...round, state: 'given_up' }
    setRounds(updated)
  }

  function handleNextRound() {
    if (roundIndex < rounds.length - 1) {
      setRoundIndex(i => i + 1)
      setInputValue('')
      setSuggestions([])
      setShowDropdown(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const currentRound = rounds[roundIndex] ?? null
  const isRoundDone = currentRound?.state !== 'playing'
  const isLastRound = roundIndex === rounds.length - 1
  const totalGuessed = rounds.reduce((sum, r) => sum + r.guessedIndices.size, 0)
  const totalPlayers = rounds.reduce((sum, r) => sum + r.players.length, 0)

  return (
    <div
      className="h-dvh flex flex-col w-full max-w-[400px] mx-auto font-sans"
      onClick={() => { if (showDropdown) { setSuggestions([]); setShowDropdown(false) } }}
    >
      {/* Header */}
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button className="text-white p-1" onClick={() => window.location.href = '/play'}>
          <Home size={22} />
        </button>
        <span className="text-white font-bold text-sm tracking-widest uppercase">
          Guess The XI
        </span>
        {rounds.length > 0 ? (
          <span className="text-white/60 text-sm font-mono">
            {roundIndex + 1} / {rounds.length}
          </span>
        ) : (
          <span className="w-8" />
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Loading session…
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <p className="text-red-500 text-sm text-center">{error}</p>
            <button onClick={loadSession} className="bg-[#1a1a2e] text-white text-sm px-4 py-2 rounded-lg">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && showFinalScore && (
          <FinalScore
            rounds={rounds}
            totalGuessed={totalGuessed}
            totalPlayers={totalPlayers}
            onPlayAgain={loadSession}
          />
        )}

        {!loading && !error && !showFinalScore && currentRound && (
          <div className="px-3 pt-4 pb-2">
            {/* Match header card */}
            <div className="mb-3 flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-3 py-3">
              <ClubBadge name={currentRound.team} wikipediaUrl={currentRound.teamWikipediaUrl} />
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-widest leading-tight truncate">
                  {abbreviateCompetition(currentRound.competition)} Final {currentRound.year}
                </p>
                <p className="text-base font-bold text-gray-900 leading-snug truncate">
                  {currentRound.team} XI{' '}
                  <span className="text-xs text-gray-400 font-normal ml-1.5">
                    vs {currentRound.homeTeam === currentRound.team ? currentRound.awayTeam : currentRound.homeTeam}
                  </span>
                </p>
              </div>
            </div>

            {/* Player list */}
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
              {currentRound.players.map((player, i) => {
                const guessed = currentRound.guessedIndices.has(i)
                const revealed = currentRound.state === 'given_up' && !guessed
                const name = currentRound.playerNames[i]

                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 px-3 h-9 border-b border-gray-100 last:border-0"
                  >
                    {/* Squad number */}
                    <span className="text-gray-400 text-xs tabular-nums w-5 text-right shrink-0">
                      {player.squadNumber ?? '—'}
                    </span>

                    {/* Position badge */}
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${POSITION_COLORS[player.position] ?? 'bg-gray-100 text-gray-600'}`}>
                      {player.position}
                    </span>

                    {/* Player name or placeholder */}
                    {guessed ? (
                      <span className="text-green-600 font-semibold text-sm flex-1">
                        {name}
                        {nationalityToFlag(player.nationality) && (
                          <span className="ml-1 text-base leading-none">{nationalityToFlag(player.nationality)}</span>
                        )}
                      </span>
                    ) : revealed ? (
                      <span className="text-red-500 font-medium text-sm flex-1">
                        {name}
                        {nationalityToFlag(player.nationality) && (
                          <span className="ml-1 text-base leading-none">{nationalityToFlag(player.nationality)}</span>
                        )}
                      </span>
                    ) : (
                      <div className="flex-1 h-px bg-gray-300 rounded-full" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      {!loading && !error && !showFinalScore && currentRound && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
          {/* Progress text */}
          <p className={`text-xs mb-2 ${currentRound.guessedIndices.size > 0 ? 'text-green-400' : 'text-white/50'}`}>
            {isRoundDone
              ? currentRound.state === 'cleared'
                ? `All 11 guessed! ✓`
                : `${currentRound.guessedIndices.size} / 11 guessed`
              : `${currentRound.guessedIndices.size} / 11 guessed`}
          </p>

          {/* Input with footballer autocomplete */}
          {!isRoundDone && (
            <div className="relative mb-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a player name…"
                className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 outline-none"
                style={{ fontSize: '16px' }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                      onMouseDown={e => { e.preventDefault(); handleGuess(s.name) }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isRoundDone && (
              <button
                onClick={handleGiveUp}
                className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                <X size={14} />
                Give Up
              </button>
            )}
            {isRoundDone && !isLastRound && (
              <button
                onClick={handleNextRound}
                className="flex-1 flex items-center justify-center gap-1 bg-white text-[#1a1a2e] text-sm font-bold py-2 rounded-lg"
              >
                Next Round
                <ChevronRight size={14} />
              </button>
            )}
            {isRoundDone && isLastRound && (
              <button
                onClick={() => setShowFinalScore(true)}
                className="flex-1 flex items-center justify-center gap-1 bg-white text-[#1a1a2e] text-sm font-bold py-2 rounded-lg"
              >
                See Results
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ClubBadge({ name, wikipediaUrl }: { name: string; wikipediaUrl: string | null }) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null)

  useEffect(() => {
    if (!wikipediaUrl) { setLogoUrl(false); return }
    const title = wikipediaUrl.split('/wiki/')[1]
    if (!title) { setLogoUrl(false); return }
    const controller = new AbortController()
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch(err => { if (err.name !== 'AbortError') setLogoUrl(false) })
    return () => controller.abort()
  }, [wikipediaUrl])

  return (
    <div className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden" style={{ borderRadius: '12px' }}>
      {logoUrl === null && <div className="w-full h-full bg-gray-200 animate-pulse rounded-full" />}
      {logoUrl === false && <span className="text-gray-400 font-bold text-sm">{name.charAt(0)}</span>}
      {logoUrl && <img src={logoUrl} alt={name} className="w-10 h-10 object-contain" />}
    </div>
  )
}

function FinalScore({
  rounds,
  totalGuessed,
  totalPlayers,
  onPlayAgain,
}: {
  rounds: RoundResult[]
  totalGuessed: number
  totalPlayers: number
  onPlayAgain: () => void
}) {
  const pct = totalPlayers > 0 ? Math.round((totalGuessed / totalPlayers) * 100) : 0
  const pctColor = pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-orange-400' : 'text-red-500'

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6">
      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Final Score</p>
        <p className={`text-5xl font-bold mt-2 ${pctColor}`}>{pct}%</p>
        <p className="text-gray-500 text-sm mt-2">{totalGuessed} / {totalPlayers} players</p>
      </div>

      <div className="w-full flex flex-col gap-2">
        {rounds.map((r, i) => {
          const guessedCount = r.guessedIndices.size
          const total = r.players.length
          const cleared = r.state === 'cleared'
          return (
            <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{r.matchName}</p>
                <p className="text-xs text-gray-500">{r.team}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-bold tabular-nums ${guessedCount === total ? 'text-green-600' : guessedCount > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                  {guessedCount}/{total}
                </span>
              </div>
              <span className="text-base">
                {cleared ? '✓' : guessedCount > 0 ? '~' : '✗'}
              </span>
            </div>
          )
        })}
      </div>

      <button
        onClick={onPlayAgain}
        className="bg-[#1a1a2e] text-white font-bold px-8 py-3 rounded-xl w-full text-sm"
      >
        Play Again
      </button>
    </div>
  )
}
