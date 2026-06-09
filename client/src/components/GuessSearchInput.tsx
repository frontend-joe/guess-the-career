import { useRef } from 'react'
import { Check, X } from 'lucide-react'
import { getFootballers, type Footballer } from '@/api/footballers'
import { useGuessSearch } from '@/hooks/useGuessSearch'

export type GuessStatus = 'correct' | 'incorrect' | null

const defaultSearch = (q: string) => getFootballers({ search: q })

interface Props<T> {
  /** Suggestion source. Defaults to footballer name search. */
  search?: (q: string) => Promise<T[]>
  getKey: (item: T) => string | number
  getLabel: (item: T) => string
  /** Marks a suggestion already guessed this round (greyed + check/✗). */
  getStatus?: (item: T) => GuessStatus
  /** Fired on click or Enter. `item` is null when the typed text matched no suggestion. */
  onSelect: (name: string, item: T | null) => void
  disabled?: boolean
  placeholder?: string
  /** Force the dropdown hidden (e.g. while a wrong-guess message shows). */
  suppressDropdown?: boolean
  limit?: number
  debounceMs?: number
  inputClassName?: string
  /** Optional external ref so the page can keep focusing the input (round changes, etc.). */
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export function GuessSearchInput<T = Footballer>({
  search,
  getKey,
  getLabel,
  getStatus,
  onSelect,
  disabled,
  placeholder = 'Type a player name…',
  suppressDropdown,
  limit,
  debounceMs,
  inputClassName,
  inputRef: externalRef,
}: Props<T>) {
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef ?? internalRef
  const { query, suggestions, show, setShow, onChange, reset } = useGuessSearch<T>(
    search ?? (defaultSearch as unknown as (q: string) => Promise<T[]>),
    { limit, debounceMs },
  )

  // Collapse distinct players who share a display name into a single suggestion
  // (e.g. the two "Michael Johnson"s). Matching a guess is by name, so the game
  // still accepts whichever same-name player is the round's valid answer — the
  // user just shouldn't see the same name listed twice.
  const seenLabels = new Set<string>()
  const deduped = suggestions.filter((s) => {
    const key = getLabel(s).toLowerCase()
    if (seenLabels.has(key)) return false
    seenLabels.add(key)
    return true
  })

  function pick(name: string, item: T | null) {
    reset()
    onSelect(name, item)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      const term = query.trim()
      const exact = deduped.find(
        (s) => getLabel(s).toLowerCase() === term.toLowerCase(),
      )
      const chosen = exact ?? deduped[0]
      if (chosen) pick(getLabel(chosen), chosen)
      else pick(term, null)
    }
    if (e.key === 'Escape') setShow(false)
  }

  const open = show && !suppressDropdown && deduped.length > 0

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        onFocus={() => { if (deduped.length > 0) setShow(true) }}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        className={
          inputClassName ??
          'w-full bg-white text-gray-900 rounded-lg px-3 py-2 outline-none disabled:opacity-60'
        }
        style={{ fontSize: '16px' }}
      />
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
          {deduped.map((item) => {
            const status = getStatus?.(item) ?? null
            if (status) {
              return (
                <div
                  key={getKey(item)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 cursor-default select-none"
                >
                  <span className="truncate">{getLabel(item)}</span>
                  <span
                    className={`ml-auto inline-flex items-center justify-center rounded-full w-4 h-4 shrink-0 ${
                      status === 'correct'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {status === 'correct' ? <Check size={11} /> : <X size={11} />}
                  </span>
                </div>
              )
            }
            return (
              <button
                key={getKey(item)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(getLabel(item), item)
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
              >
                {getLabel(item)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
