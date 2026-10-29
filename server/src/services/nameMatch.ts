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
// Surnames under 4 characters never match on their own — see the guard below.
export function matchesName(guess: string, name: string): boolean {
  const g = norm(guess)
  const p = norm(name)
  if (g === p) return true
  const gl = surnameOf(g)
  const pl = surnameOf(p)
  // A guess that is the tail of the full name, in full, is accepted whatever
  // its last word measures. surnameOf takes the final word only, so a Dutch
  // tussenvoegsel is not part of the surname as far as the rules below are
  // concerned: Edwin van der Sar's is "sar", three characters, and the short
  // surname guard then rejected "van der Sar" — the man's actual surname,
  // typed in full — leaving the full name the only guess that worked.
  //
  // This is not the short-surname rule in disguise. "Sar" alone is still too
  // little to go on; three words of a four-word name is not.
  if (g.includes(' ') && p.endsWith(` ${g}`)) return true
  if (pl.length < 4) return false
  if (g === pl) return true
  if (gl === pl) return true
  // A single-word guess also matches any OTHER whole word of the name, not
  // just the last one. Players known by one name wear it at the front —
  // Raúl González, Ronaldinho Gaúcho, Kaká — and "Raul" matched nothing,
  // because every rule here was looking at the surname.
  //
  // Four characters minimum, same as the surname rule and for the same
  // reason: "Lee" and "Ian" are first names on half the board.
  if (!g.includes(' ') && g.length >= 4 && p.split(' ').includes(g)) return true
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

// ── Places ───────────────────────────────────────────────────────────────────
//
// An authored answer is usually a place or a thing, not a person, and the rules
// above are entirely about people: a surname is the memorable half of a footballer's name, so they
// accept one on its own. Nothing equivalent is true of places. "York" is not
// New York, "Africa" is not South Africa, and "Dakota" is two different states
// — every one of which the surname rule would wave through.
//
// So places match on the WHOLE name, with two kinds of latitude instead:
//
//  - the authored alias list, for answers genuinely known by another name
//    (Huang He, Czech Republic, NYC), which no edit distance reaches; and
//  - the geographical noise words, which people drop or add freely without
//    meaning anything by it. "Mt Everest", "Everest", "Lake Baikal", "Baikal",
//    "River Nile" are all the same answer and all equally correct.
const PLACE_NOISE = /\b(?:the|mount|mt|lake|river|island|islands|isle|sea|city|and)\b/g

function placeKey(s: string): string {
  return norm(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(PLACE_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesPlace(guess: string, name: string, aliases: string[] = []): boolean {
  const g = placeKey(guess)
  if (!g) return false
  for (const candidate of [name, ...aliases]) {
    const c = placeKey(candidate)
    if (!c) continue
    if (g === c) return true
    // One typo forgiven on an ordinary name, two on a long one — "Saint
    // Vincent and the Grenadines" is going to be typed wrong by somebody who
    // knows exactly what they mean. Nothing under five characters gets any
    // latitude at all: at that length a single edit is a different place.
    const allowance = c.length >= 12 ? 2 : c.length >= 5 ? 1 : 0
    if (allowance === 0) continue
    if (Math.abs(g.length - c.length) <= allowance && damerau(g, c) <= allowance) return true
  }
  return false
}
