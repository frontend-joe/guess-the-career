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
// Surnames under 4 characters get no latitude, but an exact one still counts
// when it is the whole surname — see the guard below.
export function matchesName(guess: string, name: string, surname?: string | null): boolean {
  const g = norm(guess)
  const p = norm(name)
  if (g === p) return true
  const gl = surnameOf(g)
  // The surname the database recorded when the player was imported, where
  // there is one, and otherwise the last word of the name.
  //
  // Asking beats guessing. The last word is "Sar" for Edwin van der Sar, "Gea"
  // for David de Gea, "Jr" for Alan Kelly Jr. and "Zhi" for Zheng Zhi — whose
  // surname is Zheng, the first word. Seventy-seven players in the database
  // have a surname that is not simply the last word of their name, and it has
  // been sitting there correctly split the whole time.
  const known = surname ? norm(surname) : ''
  const pl = known || surnameOf(p)
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
  // An exact surname is an exact surname, however short.
  //
  // The guard below is about LATITUDE, and denying that to a short surname is
  // right: at two or three characters a single edit is a different person. But
  // it sat in front of the exact-match rules too, so it also turned down the
  // surname typed perfectly — "Flo" was a miss on Håvard Flo in a round about
  // surnames beginning with F, while "Havard Flo" scored.
  //
  // Length is simply not what makes a surname usable. Ba, Xu, Wu, Flo and Foé
  // are whole surnames that people say out loud, and the matcher accepted
  // eight-letter ones in any name it liked while refusing these.
  //
  // What DOES disqualify a last word is being only part of the surname, which
  // is the real complaint against "Sar" for Edwin van der Sar. That is
  // checkable: a particle in front of it says the surname is multi-part. So
  // the test is the particle, not the character count — which also means this
  // holds in a name of any length, where the previous attempt only managed
  // two-word ones and left "Tore Andre Flo" and "Marc Vivien Foe" missing.
  // An exact surname counts however short it is: Flo, Ba, Foé, Jô, Obi, Eze
  // and Tê are whole surnames people say out loud, and the length guard below
  // was turning them down for being two or three letters while waving through
  // any eight-letter one. Length buys LATITUDE, not distinctiveness — and the
  // latitude is still withheld, so "Fla" and "Flu" remain misses.
  //
  // When the surname was looked up there is nothing to second-guess. It is
  // only when falling back to the last word that a particle in front of it
  // warns the word is a fragment of a longer surname rather than the whole
  // thing — the "Sar" case — and a bare fragment that short is too little to
  // go on.
  if (g === pl && (known !== '' || !hasParticleBeforeSurname(p))) return true
  // A generational suffix is part of the recorded surname — "Kelly Jr." — but
  // not part of what anybody says out loud, and the man is still a Kelly.
  //
  // This used to be carried by the any-word-of-the-name rule removed below,
  // which happened to catch "Kelly" because it is a word of "Alan Kelly Jr."
  // That rule is gone, so the case it was quietly covering is handled here,
  // where it is actually about surnames.
  if (GENERATIONAL.test(pl) && g === withoutSuffix(pl)) return true
  if (pl.length < 4) return false
  if (g === pl) return true
  // The guess carries a surname of its own, which means it may carry a first
  // name that CONTRADICTS the board. "Marcus Thuram" is not Lilian Thuram,
  // and saying so came back as "already found" — the worst possible answer,
  // because it tells you the man you named is up there when he is not.
  //
  // The same check already guarded the typo rule below, for exactly the same
  // reason (Leighton Baines and John Barnes). It belonged here too: an exact
  // surname is no more proof of identity than a surname one letter out.
  if (gl === pl) return firstNamesAgree(g, p)
  // A forename on its own is NOT accepted, and the rule that used to accept it
  // is gone. It read any whole word of the name, so that players known by one
  // name — Raúl González, Ronaldinho Gaúcho — could be typed the way people
  // say them. What it also did was fit every row of a board built on a shared
  // first name: "La Liga players named Fernando" was solved by typing
  // Fernando six times, because the word fits all ten and the caller hands
  // over whichever is still unfound.
  //
  // The rule now is a surname, or the whole name. A player genuinely known by
  // one word has that word as their whole name — Kaká, Doni, Ronaldinho — and
  // the exact match at the top of this function already takes it. Raúl is
  // reached by González, which is the cost, and a cheap one next to a board
  // that gives itself away.
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

// The words that mark a surname as multi-part, so the final word on its own is
// a fragment of it rather than the thing itself: van der SAR, di MARIA, de
// JONG. Not an exhaustive list of the world's nobiliary particles — just the
// ones that turn up in football, which is the only place this is asked.
//
// Deliberately NOT applied to the length-gated rules below it: "Basten" has
// always been accepted for Marco van Basten and there is no reason to stop,
// only to avoid EXTENDING that to fragments too short to mean anything.
const SURNAME_PARTICLES = new Set([
  'van', 'von', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'das', 'dos',
  'do', 'du', 'le', 'la', 'el', 'al', 'ter', 'ten', 'bin', 'ibn', 'y',
])

// Jr., Sr. and the regnal numerals. Scoped to the end of a surname, so the
// Roman numerals cannot eat a name that happens to end in one.
const GENERATIONAL = /\s+(?:jr|snr|sr|ii|iii|iv)\.?$/

function withoutSuffix(surname: string): string {
  return surname.replace(GENERATIONAL, '')
}

function hasParticleBeforeSurname(normalized: string): boolean {
  const words = normalized.split(' ')
  return words.length >= 2 && SURNAME_PARTICLES.has(words[words.length - 2])
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
//
// The articles are in here for the same reason: "A Midsummer Night's Dream" and
// "A View to a Kill" are titles nobody recites the article of, and an authored
// round should not be the thing that notices.
const PLACE_NOISE = /\b(?:a|an|the|mount|mt|lake|river|island|islands|isle|sea|city|and)\b/g

function placeKey(s: string): string {
  return norm(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(PLACE_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when the guess IS the answer — its name or one of its aliases, once the
 * optional noise words are set aside — with no spelling latitude at all.
 *
 * Checked before matchesPlace rather than instead of it, because the latitude
 * that makes a typo forgivable also makes near-identical answers reachable from
 * each other. "The Gambia" strips to "gambia", which is one edit from Zambia,
 * and both are answers to "African countries ending in A": without this, naming
 * one of them could credit the other. An exact answer is never a guess at a
 * different one.
 */
export function isPlaceExactly(guess: string, name: string, aliases: string[] = []): boolean {
  const g = placeKey(guess)
  if (!g) return false
  return [name, ...aliases].some((candidate) => placeKey(candidate) === g)
}

/**
 * True when two strings are the same but for one swapped pair of neighbours.
 *
 * Its own function rather than a damerau() of 1, because a short answer must
 * not get a general edit allowance and this is the one error worth forgiving
 * at any length. See matchesPlace.
 */
function isTransposition(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const diffs: number[] = []
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      diffs.push(i)
      if (diffs.length > 2) return false
    }
  }
  return diffs.length === 2
    && diffs[1] === diffs[0] + 1
    && a[diffs[0]] === b[diffs[1]]
    && a[diffs[1]] === b[diffs[0]]
}

export function matchesPlace(guess: string, name: string, aliases: string[] = []): boolean {
  const g = placeKey(guess)
  if (!g) return false
  for (const candidate of [name, ...aliases]) {
    const c = placeKey(candidate)
    if (!c) continue
    if (g === c) return true
    // A swapped pair of neighbours is forgiven at any length, because it is a
    // different kind of error from the rest. It is what a phone keyboard does
    // to a word it does not know — Mali autocorrects to Mail, and before this
    // that was a miss on a round whose whole subject is countries beginning
    // with M — and unlike a substitution it cannot quietly turn one real
    // answer into another. The sweep in general.test.ts checks that for every
    // answer of every round.
    if (isTransposition(g, c)) return true
    // One typo forgiven on an ordinary name, two on a long one — "Saint
    // Vincent and the Grenadines" is going to be typed wrong by somebody who
    // knows exactly what they mean. Nothing under five characters gets any
    // latitude at all: at that length a single edit is a different place, and
    // Iran and Iraq both answer "countries in Asia".
    const allowance = c.length >= 12 ? 2 : c.length >= 5 ? 1 : 0
    if (allowance === 0) continue
    if (Math.abs(g.length - c.length) <= allowance && damerau(g, c) <= allowance) return true
  }
  return false
}
