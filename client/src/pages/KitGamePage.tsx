import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { getKitQuestion, type KitQuestion } from '@/api/kit-game'
import { KitSvg } from '@/components/KitSvg'

// ── Fuzzy matching ─────────────────────────────────────────────────────────────

const TRANSLITERATE: Record<string, string> = {
  ı: 'i', ł: 'l', ø: 'o', đ: 'd', ð: 'd',
  æ: 'a', œ: 'o', ħ: 'h', ŋ: 'n', ŧ: 't',
  þ: 'th', ß: 'ss',
}
const TRANSLIT_RE = /[ıłøđðæœħŋŧþß]/g

function normalizeGuess(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(TRANSLIT_RE, c => TRANSLITERATE[c] ?? c).trim()
}

function damerauDistance(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
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
  const lastName = p.split(' ').at(-1) ?? ''
  if (lastName.length >= 4 && g === lastName) return true
  if (lastName.length >= 4 && g.length >= 4 && damerauDistance(g, lastName) === 1) return true
  return false
}

// ── Main game page ─────────────────────────────────────────────────────────────

type GameStatus = 'playing' | 'correct' | 'gaveup'

export function KitGamePage() {
  const navigate = useNavigate()

  const [question, setQuestion] = useState<KitQuestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [status, setStatus] = useState<GameStatus>('playing')
  const [score, setScore] = useState(0)
  const [usedIds, setUsedIds] = useState<number[]>([])
  const [wrongGuess, setWrongGuess] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadQuestion(exclude: number[]) {
    setLoading(true)
    setStatus('playing')
    setInputValue('')
    setImgFailed(false)
    try {
      const q = await getKitQuestion(exclude)
      setQuestion(q)
    } catch {
      setQuestion(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuestion([])
  }, [])

  useEffect(() => {
    if (!loading && status === 'playing') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [loading, status])

  function triggerWrong() {
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
    setWrongGuess(true)
    wrongTimer.current = setTimeout(() => setWrongGuess(false), 600)
  }

  function handleSubmit() {
    if (!question || status !== 'playing') return
    const name = inputValue.trim()
    if (!name) return

    if (matchesPlayer(name, question.footballer_name)) {
      setStatus('correct')
      setScore(s => s + 1)
    } else {
      triggerWrong()
      setInputValue('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
  }

  function handleNext() {
    if (!question) return
    const newUsedIds = [...usedIds, question.footballer_id]
    setUsedIds(newUsedIds)
    loadQuestion(newUsedIds)
  }

  function handleGiveUp() {
    setStatus('gaveup')
  }

  const isRevealed = status === 'correct' || status === 'gaveup'

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      {/* Header */}
      <div className="bg-[#0b0c1a] divide-soft-b flex items-center justify-between px-3 py-2.5 shrink-0">
        <button className="text-white/90 hover:text-green-400 transition-colors p-1" onClick={() => navigate('/')}>
          <ArrowLeft size={22} />
        </button>
        <span className="text-white font-display text-sm tracking-wide uppercase truncate px-2">
          Guess the Kit
        </span>
        <span className="text-white/60 text-sm font-mono whitespace-nowrap flex items-center gap-1">
          {score}
          <CheckCircle2 size={14} className="text-green-400" />
        </span>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col items-center justify-center px-4 py-6 gap-4">
        {loading ? (
          <Loader2 className="animate-spin text-gray-400" size={32} />
        ) : !question ? (
          <div className="text-center text-gray-500">
            <p className="font-semibold mb-1">No more questions!</p>
            <p className="text-sm">You've seen all available kits in this session.</p>
          </div>
        ) : (
          <>
            {/* Kit SVG */}
            <div className="flex flex-col items-center gap-2">
              <KitSvg
                body={question.home_body}
                leftArm={question.home_leftarm}
                rightArm={question.home_rightarm}
                pattern={question.home_pattern}
                number={question.squad_number}
                numberColour={question.number_colour}
                className="w-56 h-auto drop-shadow-md"
              />
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                {question.club_at_time}
              </p>
            </div>

            {/* Revealed player */}
            {isRevealed && (
              <div className={`flex flex-col items-center gap-2 rounded-xl px-5 py-4 border w-full max-w-xs ${
                status === 'correct'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-orange-50 border-orange-200'
              }`}>
                {question.photo_url && !imgFailed ? (
                  <img
                    src={question.photo_url}
                    alt={question.footballer_name}
                    className="w-16 h-16 rounded-full object-cover"
                    onError={() => setImgFailed(true)}
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${
                    status === 'correct' ? 'bg-green-200 text-green-700' : 'bg-orange-200 text-orange-700'
                  }`}>
                    {question.footballer_name.charAt(0)}
                  </div>
                )}
                <p className={`font-bold text-base text-center ${
                  status === 'correct' ? 'text-green-800' : 'text-orange-800'
                }`}>
                  {question.footballer_name}
                </p>
                {status === 'correct' && (
                  <p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Correct!</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom panel */}
      <div className="bg-[#1a1a2e] px-3 py-3 shrink-0 flex flex-col gap-2">
        {!isRevealed && question && !loading ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a player name…"
              className={`w-full rounded-lg px-3 py-2.5 text-sm font-sans bg-white text-gray-900 placeholder-gray-400 outline-none transition-all ${
                wrongGuess ? 'ring-2 ring-red-400' : ''
              }`}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleGiveUp}
                className="flex-1 rounded-lg py-2 text-sm font-semibold text-white/60 hover:text-white/90 transition-colors border border-white/10 hover:border-white/30"
              >
                Give up
              </button>
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim()}
                className="flex-1 rounded-lg py-2 text-sm font-bold text-white bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors"
              >
                Guess
              </button>
            </div>
          </>
        ) : isRevealed ? (
          <button
            onClick={handleNext}
            className="w-full rounded-lg py-2.5 text-sm font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
          >
            Next →
          </button>
        ) : null}
      </div>
    </div>
  )
}
