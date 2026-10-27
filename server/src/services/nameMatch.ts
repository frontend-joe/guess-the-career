import { normalizeName } from '../db/client.ts'
import { damerau } from './playerImport.ts'

// Server-side guess matching for multiplayer rooms.
//
// In solo play the browser holds the whole answer list and matches locally —
// see matches() in client/src/pages/TenablePage.tsx. A room cannot work that
// way: the host must not hold the answers, and the server has to be the one
// that decides. This is a deliberate character-for-character port of those
// rules, NOT a reimplementation.
//
// KEEP THESE TWO IN STEP. If they drift, the web game and the app accept
// different guesses for the same board, which will be reported as a bug about
// one specific player and will take an afternoon to trace back to here.

// normalizeName() already does NFD + strip diacritics + lowercase + the
// transliteration map. The client's norm() also trims.
export function norm(s: string): string {
  return normalizeName(s).trim()
}

export function surnameOf(normalized: string): string {
  return normalized.split(' ').at(-1) ?? ''
}

// Exact match, or a surname match tolerant of one transposition/typo.
// Surnames under 4 characters never fuzzy-match — "Cole" and "Kane" are too
// close for comfort at distance 1, and short names collide constantly.
export function matchesName(guess: string, name: string): boolean {
  const g = norm(guess)
  const p = norm(name)
  if (g === p) return true
  const gl = surnameOf(g)
  const pl = surnameOf(p)
  if (pl.length < 4) return false
  if (g === pl) return true
  if (gl.length >= 4 && (gl === pl || damerau(gl, pl) === 1)) return true
  return false
}
