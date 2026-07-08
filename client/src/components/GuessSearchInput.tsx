import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, Info } from 'lucide-react'
import { getFootballers, type Footballer } from '@/api/footballers'
import { useGuessSearch } from '@/hooks/useGuessSearch'

export type GuessStatus = 'correct' | 'incorrect' | null

const defaultSearch = (q: string) => getFootballers({ search: q })

// Tap-to-toggle help bubble that sits just above the input (far right) and shows
// a popover above it. Portaled to <body> so the footer can't clip it.
function InfoBubble({ text }: { text: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const open = coords !== null

  function toggle() {
    if (open) { setCoords(null); return }
    const r = ref.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.top, left: r.right })
  }

  useEffect(() => {
    if (!open) return
    const close = () => setCoords(null)
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={toggle}
        aria-label="Guessing help"
        className="absolute right-0 bottom-full mb-2 flex items-center gap-1 text-white/70 hover:text-white transition-colors"
      >
        <Info size={16} />
        <span className="text-xs font-semibold">Info</span>
      </button>
      {open && coords && createPortal(
        <div
          className="fixed -translate-x-full -translate-y-full px-3 py-2 bg-white text-gray-700 text-xs leading-snug rounded-lg shadow-md w-48"
          style={{ top: coords.top - 8, left: coords.left, zIndex: 100 }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  )
}

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
  /** When set, shows a help bubble above the input: true = "…can also add new
   * players (…retired)", false = database-only. Omit to hide the bubble. */
  autoScrape?: boolean
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
  autoScrape,
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
      {autoScrape !== undefined && (
        <InfoBubble
          text={
            autoScrape
              ? 'You can guess any player in our database, and can also add new players (as long as they qualify and are retired)'
              : 'You can guess any player in our database'
          }
        />
      )}
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
