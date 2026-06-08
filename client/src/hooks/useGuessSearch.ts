import { useCallback, useRef, useState } from 'react'

/**
 * Owns the mechanics of the guess autocomplete: debounced search, the
 * suggestion list and the open/closed flag. Generic over the suggestion type;
 * the caller provides the `search` function (footballers, clubs, …).
 */
export function useGuessSearch<T>(
  search: (q: string) => Promise<T[]>,
  opts?: { limit?: number; debounceMs?: number },
) {
  const limit = opts?.limit ?? 8
  const debounceMs = opts?.debounceMs ?? 250

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<T[]>([])
  const [show, setShow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Monotonic id of the most recent search; stale responses are discarded so
  // an out-of-order (slower, earlier) request can't overwrite newer results.
  const seq = useRef(0)

  // Keep the latest search fn without forcing handler identity to change.
  const searchRef = useRef(search)
  searchRef.current = search

  const run = useCallback(
    (term: string) => {
      const mySeq = ++seq.current
      if (term.trim().length < 2) {
        setSuggestions([])
        setShow(false)
        return
      }
      searchRef.current(term)
        .then((r) => {
          if (mySeq !== seq.current) return // a newer search has superseded this one
          const list = r.slice(0, limit)
          setSuggestions(list)
          setShow(list.length > 0)
        })
        .catch(() => {})
    },
    [limit],
  )

  const onChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => run(value), debounceMs)
    },
    [run, debounceMs],
  )

  const reset = useCallback(() => {
    seq.current++ // discard any in-flight response
    if (timer.current) clearTimeout(timer.current)
    setQuery('')
    setSuggestions([])
    setShow(false)
  }, [])

  const close = useCallback(() => setShow(false), [])

  return { query, suggestions, show, setShow, onChange, reset, close }
}
