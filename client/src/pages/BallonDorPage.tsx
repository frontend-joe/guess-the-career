import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { Home, ChevronRight, ChevronLeft, Shuffle, Trophy, X } from 'lucide-react'
import { OverallProgressScreen } from '@/components/OverallProgressScreen'
import {
  getBallonDorRounds,
  type BallonDorRound,
} from '@/api/ballon-dor-schedule'
import { getFootballers, type Footballer } from '@/api/footballers'
import { NationalityFlag } from '@/components/NationalityFlag'
import { MiniClubBadge } from '@/components/MiniClubBadge'

const POSITION_COLOURS: Record<string, string> = {
  GK: 'bg-purple-100 text-purple-700',
  DF: 'bg-blue-100 text-blue-700',
  MF: 'bg-green-100 text-green-700',
  FW: 'bg-orange-100 text-orange-700',
}

function PositionBadge({ position }: { position: 'GK' | 'DF' | 'MF' | 'FW' }) {
  return (
    <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${POSITION_COLOURS[position]}`}>
      {position}
    </span>
  )
}

type RoundState = 'playing' | 'cleared'

interface RoundResult {
  date: string
  ballonDorId: number
  year: number
  players: BallonDorRound['players']
  playerNames: string[]
  guessedIndices: Set<number>
  state: RoundState
}

const PROGRESS_KEY = 'bd_schedule_progress'

interface SavedProgress {
  [roundKey: string]: {
    guessedIndices: number[]
    state: RoundState
  }
}

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveProgress(progress: SavedProgress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

const TRANSLITERATE: Record<string, string> = {
  ı: 'i',
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  æ: 'a',
  œ: 'o',
  ħ: 'h',
  ŋ: 'n',
  ŧ: 't',
  þ: 'th',
  ß: 'ss',
}
const TRANSLIT_RE = /[ıłøđðæœħŋŧþß]/g

function normalizeGuess(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(TRANSLIT_RE, (c) => TRANSLITERATE[c] ?? c)
    .trim()
}

function damerauDistance(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length,
    n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
    }
  }
  return dp[m][n]
}

function matchesPlayer(guess: string, playerName: string): boolean {
  const g = normalizeGuess(guess)
  const p = normalizeGuess(playerName)
  if (g === p) return true
  const parts = p.split(' ')
  const lastName = parts.at(-1) ?? ''
  if (lastName.length >= 4 && g === lastName) return true
  if (lastName.length >= 4 && g.length >= 4 && damerauDistance(g, lastName) === 1) return true
  if (parts.length > 1) {
    const firstName = parts[0]
    if (firstName.length >= 4 && g === firstName) return true
    if (firstName.length >= 4 && g.length >= 4 && damerauDistance(g, firstName) === 1) return true
  }
  return false
}

function buildRounds(data: BallonDorRound[], saved: SavedProgress): RoundResult[] {
  return data.map((r) => {
    const key = String(r.ballonDorId)
    const prog = saved[key]
    return {
      date: r.date,
      ballonDorId: r.ballonDorId,
      year: r.year,
      players: r.players,
      playerNames: r.playerNames,
      guessedIndices: prog ? new Set(prog.guessedIndices) : new Set<number>(),
      state: prog?.state ?? 'playing',
    }
  })
}

export function BallonDorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rounds, setRounds] = useState<RoundResult[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Footballer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getBallonDorRounds()
      .then((data) => {
        const saved = loadProgress()
        const built = buildRounds(data, saved)
        setRounds(built)
        const n = parseInt(searchParams.get('n') ?? '0')
        setRoundIndex(Math.min(Math.max(n, 0), built.length - 1))
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load schedule.'),
      )
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !error && rounds.length > 0 && !showProgress) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [roundIndex, loading, error, rounds.length, showProgress])

  const fetchSuggestions = useCallback((term: string) => {
    if (term.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    getFootballers({ search: term })
      .then((results) => {
        setSuggestions(results.slice(0, 8))
        setShowDropdown(results.length > 0)
      })
      .catch(() => {})
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
    matched.forEach((i) => newGuessed.add(i))
    const allGuessed = newGuessed.size === round.players.length
    const newState: RoundState = allGuessed ? 'cleared' : 'playing'

    const updated = [...rounds]
    updated[roundIndex] = { ...round, guessedIndices: newGuessed, state: newState }
    setRounds(updated)

    const progress = loadProgress()
    progress[String(round.ballonDorId)] = {
      guessedIndices: [...newGuessed],
      state: newState,
    }
    saveProgress(progress)

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

  function goToRound(index: number) {
    if (index < 0 || index >= rounds.length) return
    setRoundIndex(index)
    setSearchParams({ n: String(index) }, { replace: true })
    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)
  }

  function handlePrevious() { goToRound(roundIndex - 1) }
  function handleNext() { if (roundIndex < rounds.length - 1) goToRound(roundIndex + 1) }
  function handleRandom() {
    if (rounds.length <= 1) return
    let idx: number
    do { idx = Math.floor(Math.random() * rounds.length) } while (idx === roundIndex)
    goToRound(idx)
  }

  const currentRound = rounds[roundIndex] ?? null
  const isRoundDone = currentRound?.state === 'cleared'
  const totalGuessed = rounds.reduce((sum, r) => sum + r.guessedIndices.size, 0)
  const totalPlayers = rounds.reduce((sum, r) => sum + r.players.length, 0)

  return (
    <div
      className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans"
      onClick={() => {
        if (showDropdown) { setSuggestions([]); setShowDropdown(false) }
      }}
    >
      {/* Header */}
      <div className="bg-[#1a1a2e] relative flex items-center justify-between px-3 py-2 shrink-0">
        <button
          className="text-white p-1"
          onClick={() => (window.location.href = '/play')}
        >
          <Home size={22} />
        </button>
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-bold text-sm tracking-widest uppercase">
          Ballon d&apos;Or
        </span>
        {rounds.length > 0 ? (
          showProgress ? (
            <button
              onClick={() => setShowProgress(false)}
              className="text-white/60 hover:text-white transition-colors p-1"
            >
              <X size={18} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm font-mono">
                {roundIndex + 1} / {rounds.length}
              </span>
              <button
                onClick={() => setShowProgress(true)}
                className="text-white/40 hover:text-white/80 transition-colors p-0.5"
              >
                <Trophy size={14} />
              </button>
            </div>
          )
        ) : (
          <span className="w-8" />
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Loading schedule…
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <p className="text-red-500 text-sm text-center">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#1a1a2e] text-white text-sm px-4 py-2 rounded-lg"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && rounds.length === 0 && (
          <div className="flex items-center justify-center h-full px-6">
            <p className="text-gray-500 text-sm text-center">
              No rounds scheduled yet — check back soon.
            </p>
          </div>
        )}

        {!loading && !error && showProgress && (
          <OverallProgressScreen
            totalGuessed={totalGuessed}
            totalPlayers={totalPlayers}
            rounds={rounds.map((r) => ({
              name: String(r.year) + " Ballon d'Or",
              guessed: r.guessedIndices.size,
              total: r.players.length,
            }))}
            onRoundClick={(i) => { goToRound(i); setShowProgress(false) }}
          />
        )}

        {!loading && !error && !showProgress && currentRound && (
          <div className="px-3 pt-4 pb-2">
            {/* Year header */}
            <div className="mb-3 flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-3 py-3">
              <div className="w-12 h-12 bg-yellow-50 flex items-center justify-center shrink-0 rounded-xl border border-yellow-100">
                <Trophy size={24} className="text-yellow-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-widest leading-tight">
                  Ballon d&apos;Or
                </p>
                <p className="text-base font-bold text-gray-900 leading-snug truncate">
                  {currentRound.year}
                </p>
              </div>
            </div>

            {/* Players table */}
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-center min-w-10 py-1.5 px-3 w-8">
                      <Trophy size={10} className="text-gray-400 mx-auto" />
                    </th>
                    <th className="text-[10px] text-gray-400 font-semibold text-left py-1.5 px-2">
                      Player
                    </th>
                    <th className="py-1.5 pl-1 pr-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {currentRound.players.map((player, i) => {
                    const guessed = currentRound.guessedIndices.has(i)
                    const name = currentRound.playerNames[i]
                    return (
                      <tr
                        key={player.id}
                        className="border-b border-gray-100 last:border-0 h-9"
                      >
                        <td className="text-xs text-gray-400 tabular-nums text-center px-3">
                          {player.rank}
                        </td>
                        <td className="px-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {guessed ? (
                              <span className="flex-1 text-gray-900 font-semibold text-sm truncate">
                                {name}
                              </span>
                            ) : (
                              <div className="flex-1 h-px bg-gray-300 rounded-full" />
                            )}
                            {player.clubs.map((c) => (
                              <MiniClubBadge
                                key={c.name}
                                club={c.name}
                                wikipediaUrl={c.wikipedia_url}
                              />
                            ))}
                            <NationalityFlag nationality={player.nationality} />
                          </div>
                        </td>
                        <td className="pl-1 pr-3">
                          <div className="flex items-center justify-center h-full">
                            {player.position && <PositionBadge position={player.position} />}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      {!loading && !error && !showProgress && rounds.length > 0 && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
          {currentRound && (
            <p
              className={`text-xs mb-2 ${currentRound.guessedIndices.size > 0 ? 'text-green-400' : 'text-white/50'}`}
            >
              {isRoundDone
                ? `All ${currentRound.players.length} guessed! ✓`
                : `${currentRound.guessedIndices.size} / ${currentRound.players.length} guessed`}
            </p>
          )}

          {currentRound && !isRoundDone && (
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
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleGuess(s.name)
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handlePrevious}
              disabled={roundIndex === 0}
              className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <div className="flex items-center gap-2 text-white/60 text-xs font-mono">
              <span>#{roundIndex + 1}</span>
              <button
                onClick={handleRandom}
                className="text-white/40 hover:text-white transition-colors"
              >
                <Shuffle size={13} />
              </button>
            </div>

            <button
              onClick={handleNext}
              disabled={roundIndex === rounds.length - 1}
              className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
