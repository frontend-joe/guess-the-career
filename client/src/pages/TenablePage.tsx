import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { Loader2, Trophy, X, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react'
import { GameMenu } from '@/components/GameMenu'
import { GuessSearchInput } from '@/components/GuessSearchInput'
import { OverallProgressScreen, type ProgressRound } from '@/components/OverallProgressScreen'
import { useShowPlayer } from '@/contexts/PlayerModalContext'
import { getTenablePlayRounds, verifyTenableGuess, type TenablePlayRound } from '@/api/tenable'

const ROUND_SIZE = 10
const PROGRESS_KEY = 'tenable_progress'

// ─── progress ────────────────────────────────────────────────────────────────
interface SavedProgress { [roundId: string]: { found: number[]; wrong?: string[] } }

function loadProgress(): SavedProgress {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') } catch { return {} }
}
function persist(key: string, found: Set<number>, wrong: Set<string>) {
  const all = loadProgress()
  all[key] = { found: [...found], wrong: [...wrong] }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
}

// ─── name matching (shared approach with the other list games) ───────────────
const TRANSLIT: Record<string, string> = {
  ı: 'i', ł: 'l', ø: 'o', đ: 'd', ð: 'd', æ: 'a', œ: 'o', ħ: 'h', ŋ: 'n', ŧ: 't', þ: 'th', ß: 'ss',
}
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[ıłøđðæœħŋŧþß]/g, c => TRANSLIT[c] ?? c).trim()
}
function damerau(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
      dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
  }
  return dp[m][n]
}
function matches(guess: string, name: string): boolean {
  const g = norm(guess), p = norm(name)
  if (g === p) return true
  const gl = g.split(' ').at(-1) ?? '', pl = p.split(' ').at(-1) ?? ''
  if (pl.length < 4) return false
  if (g === pl) return true
  if (gl.length >= 4 && (gl === pl || damerau(gl, pl) === 1)) return true
  return false
}

// Fees come through in whole pounds; squad numbers as a shirt number.
function formatValue(a: { value: number; unit?: string }): string {
  if (a.unit === 'fee') {
    return a.value >= 1_000_000 ? `£${(a.value / 1_000_000).toFixed(1)}m` : `£${Math.round(a.value / 1000)}k`
  }
  if (a.unit === 'shirt') return a.value > 0 ? `#${a.value}` : '–'
  return String(a.value)
}

// ─── the inverted pyramid ────────────────────────────────────────────────────
// Row 1 is widest and they taper down, as in the show's board.
function PyramidRow({
  rank, answer, metric,
}: {
  rank: number
  answer: { footballer_id: number | null; name: string; value: number; unit?: string } | null
  metric: string
}) {
  const showPlayer = useShowPlayer()
  // 100% at rank 1 down to ~58% at rank 10.
  const width = 100 - (rank - 1) * 4.6

  return (
    <div className="flex justify-center">
      <div
        style={{ width: `${width}%` }}
        className={`relative h-11 rounded-full flex items-center justify-center px-4 transition-colors duration-300 ${
          answer
            ? 'bg-gradient-to-b from-green-400 to-green-600 shadow-[0_0_18px_-4px_rgba(34,197,94,0.8)]'
            : 'bg-gradient-to-b from-violet-500 to-violet-700'
        }`}
      >
        {answer ? (
          <button
            type="button"
            onClick={() => answer.footballer_id && showPlayer(answer.footballer_id)}
            disabled={!answer.footballer_id}
            className="flex items-center gap-2 min-w-0 w-full justify-center disabled:cursor-default"
          >
            <span className="font-display text-sm sm:text-base uppercase tracking-wide text-white truncate drop-shadow">
              {answer.name}
            </span>
            <span
              title={answer.unit ?? metric}
              className="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-black/35 text-white text-xs font-bold flex items-center justify-center tabular-nums"
            >
              {formatValue(answer)}
            </span>
          </button>
        ) : (
          <span className="font-display text-lg text-white/95 drop-shadow">{rank}</span>
        )}
      </div>
    </div>
  )
}

export function TenablePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rounds, setRounds] = useState<TenablePlayRound[]>([])
  const [found, setFound] = useState<Record<string, Set<number>>>({})
  const [wrong, setWrong] = useState<Record<string, Set<string>>>({})
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getTenablePlayRounds()
      .then(data => {
        setRounds(data)
        const saved = loadProgress()
        const f: Record<string, Set<number>> = {}
        const w: Record<string, Set<string>> = {}
        data.forEach(r => {
          const k = String(r.roundId)
          f[k] = new Set(saved[k]?.found ?? [])
          w[k] = new Set(saved[k]?.wrong ?? [])
        })
        setFound(f); setWrong(w)
        const todayIso = new Date().toISOString().split('T')[0]
        const n = parseInt(searchParams.get('round') ?? '', 10)
        const past = data.filter(r => r.date <= todayIso)
        const todayIdx = data.findIndex(r => r.date === todayIso)
        setIdx(!isNaN(n) ? Math.max(0, Math.min(n - 1, data.length - 1))
          : todayIdx >= 0 ? todayIdx : Math.max(0, past.length - 1))
      })
      .catch(() => setError('Failed to load rounds'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const round = rounds[idx]
  useEffect(() => {
    if (round) setSearchParams({ round: String(idx + 1) }, { replace: true })
  }, [idx, round]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !error && rounds.length && !showProgress)
      setTimeout(() => inputRef.current?.focus(), 50)
  }, [idx, loading, error, rounds.length, showProgress])

  const key = round ? String(round.roundId) : ''
  const foundSet = found[key] ?? new Set<number>()

  async function submit(name: string) {
    if (!round || checking) return
    const hit = round.answers.find(
      a => a.footballer_id !== null && !foundSet.has(a.footballer_id) && matches(name, a.name),
    )
    if (hit && hit.footballer_id !== null) {
      const next = new Set(foundSet).add(hit.footballer_id)
      setFound(p => ({ ...p, [key]: next }))
      persist(key, next, wrong[key] ?? new Set())
      return
    }

    // Not on the board — they may be a real answer we've never scraped.
    setChecking(true)
    try {
      const res = await verifyTenableGuess(round.roundId, name)
      if (res.valid && res.footballerId != null) {
        // Recomputed board: the newcomer may have displaced the weakest answer.
        if (res.answers) {
          setRounds(rs => rs.map(r => (r.roundId === round.roundId ? { ...r, answers: res.answers! } : r)))
        }
        const next = new Set(foundSet).add(res.footballerId)
        setFound(p => ({ ...p, [key]: next }))
        persist(key, next, wrong[key] ?? new Set())
        return
      }
    } finally {
      setChecking(false)
    }

    {
      if (flashTimer.current) clearTimeout(flashTimer.current)
      setFlash(`"${name}" isn't on the list`)
      flashTimer.current = setTimeout(() => setFlash(null), 2200)
      const w = new Set(wrong[key] ?? new Set<string>()).add(norm(name))
      setWrong(p => ({ ...p, [key]: w }))
      persist(key, foundSet, w)
    }
  }

  const progressRounds: ProgressRound[] = rounds.map((r, i) => ({
    name: (
      <span className="text-xs font-medium">
        <span className="text-gray-400 mr-1">#{i + 1}</span>{r.title}
      </span>
    ),
    icon: <Trophy size={16} className="text-gray-400" />,
    guessed: Math.min((found[String(r.roundId)] ?? new Set()).size, r.target || ROUND_SIZE),
    total: r.ordered ? (r.answers.length || ROUND_SIZE) : (r.target || ROUND_SIZE),
  }))

  if (loading) {
    return <div className="h-dvh flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-gray-400" size={28} />
    </div>
  }
  if (error || rounds.length === 0) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 bg-gray-50 px-6">
        <p className="text-gray-500 text-sm text-center">{error ?? 'No rounds scheduled yet'}</p>
        <button onClick={() => (window.location.href = '/')} className="text-sm text-blue-600 underline">
          Back to games
        </button>
      </div>
    )
  }

  // Ordered rounds show the ranked ten; unordered rounds need any `target` of
  // a larger pool, filling the board in the order they're found.
  const total = round.ordered ? (round.answers.length || ROUND_SIZE) : (round.target || ROUND_SIZE)
  // Count only found players still on the board — a scraped newcomer can
  // displace an answer the player had already found.
  const foundList = [...foundSet]
    .map(id => round.answers.find(a => a.footballer_id === id))
    .filter(Boolean) as typeof round.answers
  const foundOnBoard = foundList.length
  const done = foundOnBoard >= total

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans bg-[#0b0c1a]">
      <div className="bg-[#0b0c1a] relative flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-display text-sm tracking-wide uppercase">
          Football Tenable
        </span>
        <button className="text-white/90 hover:text-green-400 p-1" onClick={() => setShowProgress(v => !v)}>
          {showProgress ? <X size={20} /> : <Trophy size={20} />}
        </button>
      </div>

      {showProgress ? (
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <OverallProgressScreen
            totalGuessed={rounds.filter(r => (found[String(r.roundId)] ?? new Set()).size >= (r.ordered ? r.answers.length : r.target)).length}
            totalPlayers={rounds.length}
            rounds={progressRounds}
            onRoundClick={i => { setIdx(i); setShowProgress(false) }}
            label="completed"
          />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 px-3 pt-2 pb-3">
            {/* segmented progress, as on the show's board */}
            <div className="flex items-center gap-1 mb-3">
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-sm ${i < foundOnBoard ? 'bg-green-500' : 'bg-white/15'}`} />
              ))}
              <span className="text-white text-xs font-bold tabular-nums ml-1.5">{foundOnBoard}/{total}</span>
            </div>

            <h1 className="text-center text-white font-display text-sm leading-snug mb-3 px-2">
              {round.title}
            </h1>

            <div className="flex flex-col gap-1.5">
              {round.ordered
                ? round.answers.map(a => (
                    <PyramidRow
                      key={a.rank}
                      rank={a.rank ?? 0}
                      metric={round.metric}
                      answer={a.footballer_id !== null && foundSet.has(a.footballer_id) ? a : null}
                    />
                  ))
                : Array.from({ length: total }).map((_, i) => (
                    <PyramidRow
                      key={i}
                      rank={i + 1}
                      metric={round.metric}
                      answer={foundList[i] ?? null}
                    />
                  ))}
            </div>
          </div>

          <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
            <p className={`text-xs mb-2 ${checking ? 'text-yellow-400' : done ? 'text-green-400' : 'text-white/50'}`}>
              {checking ? 'Checking…' : done ? `All ${total} found! ✓` : `${foundOnBoard} / ${total} found`}
            </p>
            {flash && (
              <div className="mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600 text-center">
                {flash}
              </div>
            )}
            {!done && (
              <div className="mb-3">
                <GuessSearchInput
                  autoScrape={false}
                  inputRef={inputRef}
                  disabled={checking}
                  getKey={f => f.id}
                  getLabel={f => f.name}
                  getStatus={s => {
                    if (round.answers.some(a => a.footballer_id !== null && foundSet.has(a.footballer_id) && matches(s.name, a.name))) return 'correct'
                    if ((wrong[key] ?? new Set()).has(norm(s.name))) return 'incorrect'
                    return null
                  }}
                  onSelect={name => submit(name)}
                />
              </div>
            )}
            <div className="relative flex items-center justify-between pt-1">
              <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                className="flex items-center gap-0.5 text-white text-sm font-bold uppercase disabled:opacity-30">
                <ChevronLeft size={16} />Prev
              </button>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-xs font-mono">
                <span><span className="text-white">#{idx + 1}</span><span className="text-white/50">/{rounds.length}</span></span>
                <button onClick={() => setIdx(Math.floor(Math.random() * rounds.length))}
                  className="text-white/40 hover:text-white"><Shuffle size={13} /></button>
              </div>
              <button onClick={() => setIdx(i => Math.min(rounds.length - 1, i + 1))}
                disabled={idx === rounds.length - 1}
                className="flex items-center gap-0.5 text-white text-sm font-bold uppercase disabled:opacity-30">
                Next<ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
