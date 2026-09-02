import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronRight, ChevronLeft, Shuffle, Trophy, X } from 'lucide-react'
import { GameMenu } from "@/components/GameMenu";
import { NationalityFlag } from '@/components/NationalityFlag'
import { OverallProgressScreen } from '@/components/OverallProgressScreen'
import { getSopRounds, type SopRound } from '@/api/sop-schedule'
import { GuessSearchInput } from '@/components/GuessSearchInput'
import { getSopLeaderboard, submitSopScore, type SopLeaderboardEntry } from '@/api/sop-leaderboard'
import { GameSettingsButton } from "@/components/GameSettingsButton";

type RoundState = 'playing' | 'cleared'

interface RoundResult extends SopRound {
  state: RoundState
  wrongGuesses: Set<string>
}

const PROGRESS_KEY = 'sop_progress'

interface RoundProgress {
  cleared?: boolean
  wrong?: string[]
}
interface SavedProgress {
  [footballerId: string]: RoundProgress
}

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    // Migrate the old shape ({ [id]: 'cleared' }).
    const out: SavedProgress = {}
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = v === 'cleared' ? { cleared: true } : (v as RoundProgress)
    }
    return out
  } catch {
    return {}
  }
}

function saveProgress(progress: SavedProgress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

const TRANSLITERATE: Record<string, string> = {
  ı: 'i', ł: 'l', ø: 'o', đ: 'd', ð: 'd', æ: 'a', œ: 'o', ħ: 'h', ŋ: 'n', ŧ: 't', þ: 'th', ß: 'ss',
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
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
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

function renderHistoryText(text: string, cleared: boolean, name: string) {
  return text.split(/(_+)/).map((part, i) => {
    if (!/^_+$/.test(part)) return <span key={i}>{part}</span>
    if (cleared) {
      return (
        <span key={i} className="inline-block bg-green-100 text-green-800 font-semibold rounded-sm px-1.5 mx-0.5 align-middle" style={{ border: '1px solid #4ade80' }}>
          {name}
        </span>
      )
    }
    return (
      <span key={i} className="inline-block mx-0.5 align-middle" style={{
        minWidth: `${Math.max(1.5, part.length * 0.55)}em`,
        height: '1.1em',
        backgroundColor: '#eff6ff',
        border: '1.5px solid #3b82f6',
        borderRadius: '3px',
        backgroundImage: 'linear-gradient(#2563eb, #2563eb)',
        backgroundSize: 'calc(100% - 8px) 1px',
        backgroundPosition: '4px calc(100% - 4px)',
        backgroundRepeat: 'no-repeat',
      }} />
    )
  })
}

function renderWithBlanks(text: string) {
  return text.split(/(_+)/).map((part, i) =>
    /^_+$/.test(part) ? (
      <span
        key={i}
        className="inline-block mx-0.5 align-middle relative"
        style={{
          minWidth: `${Math.max(1.5, part.length * 0.55)}em`,
          height: '1.3em',
          backgroundColor: '#eff6ff',
          border: '1.5px solid #3b82f6',
          borderRadius: '3px',
          backgroundImage: 'linear-gradient(#2563eb, #2563eb)',
          backgroundSize: 'calc(100% - 8px) 1px',
          backgroundPosition: '4px calc(100% - 4px)',
          backgroundRepeat: 'no-repeat',
        }}
      />
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function buildRounds(data: SopRound[], saved: SavedProgress): RoundResult[] {
  return data.map(r => {
    const prog = saved[String(r.footballerId)]
    return {
      ...r,
      state: prog?.cleared ? 'cleared' : 'playing',
      wrongGuesses: new Set(prog?.wrong ?? []),
    }
  })
}

export function StyleOfPlayPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rounds, setRounds] = useState<RoundResult[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [showProgress, setShowProgress] = useState(false)
  const [showFinalScore, setShowFinalScore] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [roundIndex, showProgress])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getSopRounds()
      .then(data => {
        const saved = loadProgress()
        const built = buildRounds(data, saved)
        setRounds(built)
        const n = parseInt(searchParams.get('n') ?? '0')
        setRoundIndex(Math.min(Math.max(n, 0), built.length - 1))
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load schedule.'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !error && rounds.length > 0 && !showFinalScore) {
      const round = rounds[roundIndex]
      if (round?.state === 'playing') {
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
  }, [roundIndex, loading, error, rounds.length, showFinalScore])

  function handleGuess(name: string) {
    const round = rounds[roundIndex]
    if (!round || round.state !== 'playing') return

    if (!matchesPlayer(name, round.footballerName)) {
      const newWrong = new Set(round.wrongGuesses)
      newWrong.add(normalizeGuess(name))
      const updated = [...rounds]
      updated[roundIndex] = { ...round, wrongGuesses: newWrong }
      setRounds(updated)
      const progress = loadProgress()
      progress[String(round.footballerId)] = {
        cleared: false,
        wrong: [...newWrong],
      }
      saveProgress(progress)
      return
    }

    const updated = [...rounds]
    updated[roundIndex] = { ...round, state: 'cleared' }
    setRounds(updated)

    const progress = loadProgress()
    progress[String(round.footballerId)] = {
      cleared: true,
      wrong: [...round.wrongGuesses],
    }
    saveProgress(progress)
  }

  function guessStatus(round: RoundResult, s: { name: string }) {
    if (round.state === 'cleared' && matchesPlayer(s.name, round.footballerName))
      return 'correct' as const
    if (round.wrongGuesses.has(normalizeGuess(s.name))) return 'incorrect' as const
    return null
  }

  function goToRound(index: number) {
    if (index < 0 || index >= rounds.length) return
    setRoundIndex(index)
    setSearchParams({ n: String(index) }, { replace: true })
  }

  function handleRandom() {
    if (rounds.length <= 1) return
    let idx: number
    do { idx = Math.floor(Math.random() * rounds.length) } while (idx === roundIndex)
    goToRound(idx)
  }

  const currentRound = rounds[roundIndex] ?? null
  const isRoundDone = currentRound?.state === 'cleared'
  const isLastRound = roundIndex === rounds.length - 1
  const allCleared = rounds.length > 0 && rounds.every(r => r.state === 'cleared')
  const totalGuessed = rounds.filter(r => r.state === 'cleared').length
  const totalPlayers = rounds.length

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      {/* Header */}
      <div className="bg-[#0b0c1a] divide-soft-b relative flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-display text-sm tracking-wide uppercase">
          Style Of Play
        </span>
        <div className="flex items-center gap-1">
          {rounds.length > 0 ? (
            showProgress ? (
              <button onClick={() => setShowProgress(false)} className="text-white/60 hover:text-white transition-colors p-1">
                <X size={18} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-sm font-mono">{roundIndex + 1} / {rounds.length}</span>
                <button onClick={() => setShowProgress(true)} className="text-white/40 hover:text-white/80 transition-colors p-0.5">
                  <Trophy size={14} />
                </button>
              </div>
            )
          ) : null}
          <GameSettingsButton gameKey="style_of_play" />
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">Loading schedule…</div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <p className="text-red-500 text-sm text-center">{error}</p>
            <button onClick={() => window.location.reload()} className="bg-[#1a1a2e] text-white text-sm px-4 py-2 rounded-lg">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && rounds.length === 0 && (
          <div className="flex items-center justify-center h-full px-6">
            <p className="text-gray-500 text-sm text-center">No rounds scheduled yet — check back soon.</p>
          </div>
        )}

        {!loading && !error && !showFinalScore && showProgress && (
          <OverallProgressScreen
            totalGuessed={totalGuessed}
            totalPlayers={totalPlayers}
            rounds={rounds.map((r, i) => ({
              name: <><span className="text-gray-400 mr-1">#{i + 1}</span>{renderHistoryText(r.historyText, r.state === 'cleared', r.footballerName)}{r.historyText.length >= 40 ? '…' : ''}</>,
              guessed: r.state === 'cleared' ? 1 : 0,
              total: 1,
            }))}
            onRoundClick={(i) => { goToRound(i); setShowProgress(false) }}
          />
        )}

        {!loading && !error && !showFinalScore && !showProgress && currentRound && (
          <div className="px-4 pt-5 pb-3">
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-6 shadow-sm">
              <div className="border-b border-gray-300 mb-4 pb-1 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Style of play</h2>
                <div className="flex items-center gap-2">
                  {currentRound.activeYears && (
                    <span className="text-xs text-gray-400">{currentRound.activeYears}</span>
                  )}
                  <NationalityFlag nationality={currentRound.nationality} size={20} />
                </div>
              </div>
              <p
                className="text-gray-900 leading-7 text-base whitespace-pre-wrap"
                style={{ fontFamily: '"Linux Libertine","Georgia","Times New Roman",serif' }}
              >
                {isRoundDone
                  ? currentRound.styleOfPlay.split(/(_+)/).map((part, i) =>
                      /^_+$/.test(part)
                        ? <span key={i}>{currentRound.footballerName}</span>
                        : <span key={i}>{part}</span>
                    )
                  : renderWithBlanks(currentRound.styleOfPlay)
                }
              </p>
            </div>

          </div>
        )}
      </div>

      {/* Bottom panel */}
      {!loading && !error && !showFinalScore && !showProgress && rounds.length > 0 && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
          {currentRound && isRoundDone && (
            <div className="flex items-center gap-2 bg-green-500/20 rounded-lg px-4 py-2.5 mb-3" style={{ border: '1px solid #4ade80' }}>
              <span className="text-green-400 font-bold text-sm">✓</span>
              <span className="text-green-300 font-semibold text-sm">{currentRound.footballerName}</span>
            </div>
          )}
          {currentRound && !isRoundDone && (
            <>
              <p className="text-white/50 text-xs mb-2">Who is this?</p>
              <div className="mb-3">
                <GuessSearchInput
                  key={currentRound.footballerId}
                  inputRef={inputRef}
                  getKey={f => f.id}
                  getLabel={f => f.name}
                  getStatus={f => guessStatus(currentRound, f)}
                  onSelect={name => handleGuess(name)}
                />
              </div>
            </>
          )}


          <div className="relative flex items-center justify-between pt-1">
            <button
              onClick={() => goToRound(roundIndex - 1)}
              disabled={roundIndex === 0}
              className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-white/60 text-xs font-mono">
              <span>#{roundIndex + 1}</span>
              <button onClick={handleRandom} className="text-white/40 hover:text-white transition-colors">
                <Shuffle size={13} />
              </button>
            </div>

            {isRoundDone && isLastRound && allCleared ? (
              <button
                onClick={() => setShowFinalScore(true)}
                className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide"
              >
                Results
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => goToRound(roundIndex + 1)}
                disabled={roundIndex === rounds.length - 1}
                className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && !error && showFinalScore && (
        <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
          <FinalScore
            rounds={rounds}
            totalGuessed={totalGuessed}
            totalPlayers={totalPlayers}
            onBack={() => setShowFinalScore(false)}
          />
        </div>
      )}
    </div>
  )
}

function FinalScore({
  rounds,
  totalGuessed,
  totalPlayers,
  onBack,
}: {
  rounds: RoundResult[]
  totalGuessed: number
  totalPlayers: number
  onBack: () => void
}) {
  const pct = totalPlayers > 0 ? Math.round((totalGuessed / totalPlayers) * 100) : 0
  const pctColor = pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-orange-400' : 'text-red-500'
  const allCleared = rounds.every(r => r.state === 'cleared')

  const [tab, setTab] = useState<'score' | 'leaderboard'>('score')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<SopLeaderboardEntry[] | null>(null)
  const [leaderboardError, setLeaderboardError] = useState(false)

  useEffect(() => {
    if (tab === 'leaderboard' && leaderboard === null) {
      getSopLeaderboard()
        .then(setLeaderboard)
        .catch(() => setLeaderboardError(true))
    }
  }, [tab, leaderboard])

  async function handleSubmit() {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitSopScore(name.trim(), totalGuessed, totalPlayers)
      setSubmitted(true)
      setLeaderboard(null)
    } catch {
      setSubmitError('Failed to save score. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6">
      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Final Score</p>
        <p className={`text-5xl font-bold mt-2 ${pctColor}`}>{pct}%</p>
        <p className="text-gray-500 text-sm mt-2">{totalGuessed} / {totalPlayers} rounds</p>
      </div>

      <div className="flex w-full rounded-xl overflow-hidden border border-gray-200">
        <button
          onClick={() => setTab('score')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === 'score' ? 'bg-[#1a1a2e] text-white' : 'bg-white text-gray-500'}`}
        >
          Results
        </button>
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === 'leaderboard' ? 'bg-[#1a1a2e] text-white' : 'bg-white text-gray-500'}`}
        >
          Leaderboard
        </button>
      </div>

      {tab === 'score' && (
        <>
          <div className="w-full flex flex-col gap-2">
            {rounds.map((r, i) => {
              const cleared = r.state === 'cleared'
              return (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900">
                      <span className="text-gray-400 mr-1">#{i + 1}</span>{renderHistoryText(r.historyText, cleared, r.footballerName)}{r.historyText.length >= 40 ? '…' : ''}
                    </p>
                    <p className="text-xs text-gray-500">{r.date}</p>
                  </div>
                  <span className="text-base">{cleared ? '✓' : '✗'}</span>
                </div>
              )
            })}
          </div>

          {allCleared && (
            <div className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
              <p className="text-xs text-gray-400 uppercase tracking-widest text-center">
                Perfect score — enter the leaderboard
              </p>
              {submitted ? (
                <p className="text-sm text-green-600 font-semibold text-center">✓ Score saved!</p>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    maxLength={50}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                  />
                  {submitError && <p className="text-xs text-red-500">{submitError}</p>}
                  <button
                    onClick={handleSubmit}
                    disabled={!name.trim() || submitting}
                    className="w-full bg-[#1a1a2e] text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-40"
                  >
                    {submitting ? 'Saving…' : 'Submit to Leaderboard'}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'leaderboard' && (
        <div className="w-full flex flex-col gap-2">
          {leaderboardError && <p className="text-sm text-red-500 text-center">Failed to load leaderboard.</p>}
          {leaderboard === null && !leaderboardError && <p className="text-sm text-gray-400 text-center">Loading…</p>}
          {leaderboard && leaderboard.length === 0 && (
            <p className="text-sm text-gray-400 text-center">No scores yet. Be the first!</p>
          )}
          {leaderboard && leaderboard.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
              <span className="text-xs font-bold text-gray-400 w-5 tabular-nums">{i + 1}</span>
              <span className="flex-1 text-sm font-semibold text-gray-900 truncate">{entry.player_name}</span>
              <span className="text-sm font-bold tabular-nums text-green-600">{entry.score}/{entry.total}</span>
              <span className="text-xs text-gray-400 tabular-nums">{Math.round((entry.score / entry.total) * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={onBack} className="bg-[#1a1a2e] text-white font-bold px-8 py-3 rounded-xl w-full text-sm">
        Back to Game
      </button>
    </div>
  )
}
