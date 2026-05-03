import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { Menu, BarChart2, Shuffle, ChevronLeft, ChevronRight, X, Lightbulb } from 'lucide-react'
import { getDays, type Day } from '@/api/days'
import { getFootballers, getFootballer, type Footballer, type FootballerWithStints, type CareerStint } from '@/api/footballers'

type GuessState = 'playing' | 'won' | 'lost'

const SOLVED_KEY = 'gtc_solved'
const GIVEN_UP_KEY = 'gtc_given_up'

function loadSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveSet(key: string, set: Set<number>) {
  localStorage.setItem(key, JSON.stringify([...set]))
}

export function PlayPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [schedule, setSchedule] = useState<Day[]>([])
  const [scheduleIndex, setScheduleIndex] = useState(0)
  const [footballer, setFootballer] = useState<FootballerWithStints | null>(null)
  const [loading, setLoading] = useState(true)
  const [revealedCount, setRevealedCount] = useState(1)
  const [guesses, setGuesses] = useState<string[]>([])
  const [guessState, setGuessState] = useState<GuessState>('playing')
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Footballer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const solvedRef = useRef<Set<number>>(loadSet(SOLVED_KEY))
  const givenUpRef = useRef<Set<number>>(loadSet(GIVEN_UP_KEY))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const seniorStints = footballer?.stints.filter(s => s.stint_type === 'senior') ?? []
  const intlStints = footballer?.stints.filter(s => s.stint_type === 'international') ?? []
  const orderedStints = [...seniorStints, ...intlStints]
  const totalStints = orderedStints.length
  const revealedSenior = Math.min(revealedCount, seniorStints.length)
  const revealedIntl = Math.max(0, revealedCount - seniorStints.length)

  const hasNationality = Boolean(footballer?.nationality)
  const hasPosition = Boolean(footballer?.position)
  const totalGuesses = totalStints + (hasNationality ? 1 : 0) + (hasPosition ? 1 : 0)
  const nationalityRevealed = guessState !== 'playing' || revealedCount > totalStints
  const positionRevealed = guessState !== 'playing' || revealedCount > totalStints + (hasNationality ? 1 : 0)

  useEffect(() => {
    getDays().then(days => {
      const assigned = days.filter(d => d.footballer_id !== null)
      setSchedule(assigned)
      const n = parseInt(searchParams.get('n') ?? '1', 10)
      const idx = Number.isFinite(n) ? Math.max(0, Math.min(n - 1, assigned.length - 1)) : 0
      setScheduleIndex(idx)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!schedule.length) return
    setSearchParams({ n: String(scheduleIndex + 1) }, { replace: true })
  }, [scheduleIndex, schedule.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!schedule.length) return
    const day = schedule[scheduleIndex]
    if (!day?.footballer_id) return
    setLoading(true)
    setRevealedCount(1)
    setGuesses([])
    setGuessState('playing')
    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)
    getFootballer(day.footballer_id).then(f => {
      setFootballer(f)
      if (solvedRef.current.has(f.id)) setGuessState('won')
      else if (givenUpRef.current.has(f.id)) setGuessState('lost')
      setLoading(false)
    })
  }, [scheduleIndex, schedule])

  const fetchSuggestions = useCallback((term: string) => {
    if (term.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    getFootballers({ search: term }).then(results => {
      setSuggestions(results.slice(0, 8))
      setShowDropdown(results.length > 0)
    })
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 200)
  }

  function handleGuess(name: string) {
    if (guessState !== 'playing') return
    const newGuesses = [...guesses, name]
    setGuesses(newGuesses)
    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)

    if (name.toLowerCase().trim() === footballer!.name.toLowerCase().trim()) {
      solvedRef.current.add(footballer!.id)
      saveSet(SOLVED_KEY, solvedRef.current)
      setGuessState('won')
    } else if (newGuesses.length >= totalGuesses) {
      setGuessState('lost')
    } else {
      setRevealedCount(c => Math.min(c + 1, totalGuesses))
    }
  }

  function handlePrevious() {
    setScheduleIndex(i => Math.max(0, i - 1))
  }

  function handleSkip() {
    setScheduleIndex(i => (i + 1) % schedule.length)
  }

  function handleRandom() {
    setScheduleIndex(Math.floor(Math.random() * schedule.length))
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 w-full max-w-100 mx-auto font-sans">
      {/* Top bar */}
      <header className="bg-[#1a1a2e] flex items-center justify-between px-4 py-3 shrink-0">
        <button className="text-white p-1">
          <Menu size={22} />
        </button>
        <h1 className="text-white font-bold text-sm tracking-[0.2em] uppercase">
          Guess the Career
        </h1>
        <button className="text-white p-1">
          <BarChart2 size={22} />
        </button>
      </header>

      {/* Scrollable career table */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-center text-gray-400 py-12 text-sm">Loading...</div>
        ) : !footballer ? (
          <div className="text-center text-gray-400 py-12 text-sm">No footballer scheduled.</div>
        ) : (
          <div className="bg-white rounded shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
              <tbody>
                <SectionHeader label="Personal information" />
                <InfoRow label="Nationality" value={footballer.nationality} revealed={nationalityRevealed} />
                <InfoRow label="Position" value={footballer.position} revealed={positionRevealed} />
                <SectionHeader label="Senior Career" />
                <ColHeaders />
                {seniorStints.map((stint, i) => (
                  <StintRow
                    key={stint.id}
                    stint={stint}
                    revealed={i < revealedSenior || guessState === 'lost' || guessState === 'won'}
                  />
                ))}
                {intlStints.length > 0 && (
                  <>
                    <SectionHeader label="International Career" />
                    <ColHeaders />
                    {intlStints.map((stint, i) => (
                      <StintRow
                        key={stint.id}
                        stint={stint}
                        revealed={i < revealedIntl || guessState === 'lost' || guessState === 'won'}
                      />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-2">
        {/* Previous guesses as chips */}
        {guesses.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {guesses.map((g, i) => {
              const correct = g.toLowerCase().trim() === footballer?.name.toLowerCase().trim()
              return (
                <span
                  key={i}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${correct ? 'bg-green-500 text-white' : 'bg-red-600 text-white'}`}
                >
                  {g}
                </span>
              )
            })}
          </div>
        )}

        {/* Status messages */}
        {guessState === 'won' && (
          <div className="text-green-400 text-sm font-semibold text-center mb-2">
            ✓ Correct! It was {footballer?.name}
          </div>
        )}
        {guessState === 'lost' && (
          <div className="text-red-400 text-sm font-semibold text-center mb-2">
            It was {footballer?.name}
          </div>
        )}

        {/* Guess input */}
        {guessState === 'playing' && (
          <div className="flex mb-1">
            <button
              onClick={() => setRevealedCount(c => Math.min(c + 1, totalGuesses))}
              disabled={revealedCount >= totalGuesses}
              className="w-1/2 flex justify-center items-center gap-1.5 text-base text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-30"
            >
              <Lightbulb size={16} />
              Clue
            </button>
            <button
              onClick={() => {
                givenUpRef.current.add(footballer!.id)
                saveSet(GIVEN_UP_KEY, givenUpRef.current)
                setGuessState('lost')
              }}
              className="w-1/2 flex justify-center items-center gap-1.5 text-base text-red-400 hover:text-red-300 transition-colors"
            >
              <X size={16} />
              Quit
            </button>
          </div>
        )}
        {guessState === 'playing' && (
          <div className="relative mb-2">
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-white rounded shadow-lg max-h-52 overflow-y-auto z-10 border border-gray-200">
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    onMouseDown={() => handleGuess(s.name)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
              placeholder={`Guess ${guesses.length + 1} of ${totalGuesses}`}
              className="w-full bg-[#2a2a4e] text-white placeholder-gray-400 rounded px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        )}

        {/* Navigation footer */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handlePrevious}
            disabled={scheduleIndex === 0}
            className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div className="flex items-center gap-2 text-white text-sm font-bold">
            <span>#{scheduleIndex + 1}</span>
            <button onClick={handleRandom} className="text-gray-400 hover:text-white transition-colors">
              <Shuffle size={14} />
            </button>
          </div>

          <button
            onClick={handleSkip}
            className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide"
          >
            {guessState !== 'playing' ? 'Next' : 'Skip'}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, revealed }: { label: string; value: string | null; revealed: boolean }) {
  return (
    <tr className="border-b border-gray-200">
      <td className="py-1.5 px-2 text-sm font-bold text-[#202122] whitespace-nowrap w-24">
        {label}
      </td>
      <td colSpan={3} className="py-1.5 px-2 text-sm">
        {revealed && value
          ? value
          : <span className="font-mono text-gray-400">——————</span>}
      </td>
    </tr>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <th
        colSpan={4}
        className="py-2 px-2 text-sm font-bold text-center bg-[#cee0f2] text-[#202122]"
      >
        {label}
      </th>
    </tr>
  )
}

function ColHeaders() {
  return (
    <tr className="text-[#202122]">
      <th className="py-1.5 px-2 text-sm font-bold text-left">Years</th>
      <th className="py-1.5 px-2 text-sm font-bold text-left">Team</th>
      <th className="py-1.5 px-2 text-sm font-bold text-right">Apps</th>
      <th className="py-1.5 px-2 text-sm font-bold text-right">(Gls)</th>
    </tr>
  )
}

function StintRow({ stint, revealed }: { stint: CareerStint; revealed: boolean }) {
  if (revealed) {
    return (
      <tr className="border-b border-gray-200">
        <td className="py-1.5 px-2 text-sm">{stint.years}</td>
        <td className="py-1.5 px-2 text-sm">{stint.club}</td>
        <td className="py-1.5 px-2 text-sm text-right">{stint.apps ?? '—'}</td>
        <td className="py-1.5 px-2 text-sm text-right">({stint.goals ?? '—'})</td>
      </tr>
    )
  }
  return (
    <tr className="border-b border-gray-200">
      <td className="py-1.5 px-2 font-mono text-gray-400 text-sm">————</td>
      <td className="py-1.5 px-2 font-mono text-gray-400 text-sm">——————</td>
      <td className="py-1.5 px-2 font-mono text-gray-400 text-sm text-right">——</td>
      <td className="py-1.5 px-2 font-mono text-gray-400 text-sm text-right">(——)</td>
    </tr>
  )
}
