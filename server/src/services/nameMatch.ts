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
  if (gl === pl) return true
  // One typo in the surname is forgiven — but NOT when both names carry a
  // first name and the two disagree.
  //
  // "Leighton Baines" was being credited to John Barnes: baines and barnes are
  // one edit apart, and nothing was looking at the half of the name that says
  // they are different people. Worse than a wrong answer, it swallowed the
  // guess — the name never reached the unknown-name path, so the player it
  // actually referred to was never looked up.
  //
  // This is the one place the server knowingly differs from the solo game's
  // matches(), which has no second name to compare because it is matching
  // against a board the browser already holds.
  if (gl.length >= 4 && damerau(gl, pl) === 1) return firstNamesAgree(g, p)
  return false
}

/// True when either side has no first name to compare, the first names match,
/// or one is the other's initial ("l baines" and "leighton baines").
function firstNamesAgree(g: string, p: string): boolean {
  const gf = g.split(' ')[0]
  const pf = p.split(' ')[0]
  if (g.split(' ').length < 2 || p.split(' ').length < 2) return true
  if (gf === pf) return true
  return (gf.length === 1 && pf.startsWith(gf)) || (pf.length === 1 && gf.startsWith(pf))
}
