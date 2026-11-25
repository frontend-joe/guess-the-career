// Which job on a football pitch a player did.
//
// Wikipedia infoboxes do not agree on a vocabulary. The same role is written
// "Centre-back", "Centre back", "Center-back" and "Central defender"; a
// player is "Defender" on one page and "Full-back, Centre-back, Defensive
// midfielder, Forward" on another. Forty-one spellings across the whole
// database, which is small enough to simply write down.
//
// The buckets are SPECIFIC — right-backs, wingers, central midfielders —
// because the broad four made boards nobody had to think about. "Arsenal
// defenders" is forty names and no challenge; "Arsenal right-backs" is a
// question. It also thins the round list hard, which is the other half of
// the same complaint: a club needs ten of one specific job before it gets a
// board at all, and most do not.
//
// A player belongs to as many buckets as their position names, because the
// WHOLE field decides rather than the first word of it. Philipp Lahm is
// "Right-back, left-back, midfielder", so he is on both full-back boards.
//
// Two spellings are deliberately unmapped. "Defender" and "midfielder" say
// only the half of the pitch, and a board of right-backs cannot take a man
// who might have been a centre-half; "full-back" and "wing-back" without a
// side are the same problem one level down. Those players are absent from
// these boards rather than guessed at — see `custom_position`, which is
// where a human answer goes when the scrape cannot give one.
//
// "Forward" is not one of them, because that half of the pitch has two
// buckets rather than four and the other one is spelt out: a winger is
// written "Winger".
//
// And where the infobox says only the half, the ARTICLE often says the rest:
// Garry Parker's box says "Midfielder" and his Forest paragraph says he was
// moved into "his favoured central midfield position". That reading arrives
// as `prose_position` — see positionFromProse in services/scraper.ts — and
// is consulted only when the infobox has given nothing usable.
//
// The `all_positions` column is deliberately not read, though it is the
// richer one. It lists every position a player ever occupied, including the
// afternoon they went in goal: it has Ronaldo, Scholes, Drogba, Puyol and
// Neymar down as goalkeepers, and Gerrard at right-back. It is usable only
// as a refinement of a position already known — "Forward" plus a listed
// "Left winger" is a winger — and that reading has been applied once, into
// `custom_position`, rather than left to run on every query.

export type PositionBucket =
  | 'goalkeeper'
  | 'right-back'
  | 'centre-back'
  | 'left-back'
  | 'defensive midfielder'
  | 'central midfielder'
  | 'attacking midfielder'
  | 'winger'
  | 'striker'

// Listed down the pitch, so a player with several reads in a sensible order.
export const POSITION_BUCKETS: { bucket: PositionBucket; plural: string }[] = [
  { bucket: 'goalkeeper', plural: 'goalkeepers' },
  { bucket: 'right-back', plural: 'right-backs' },
  { bucket: 'centre-back', plural: 'centre-backs' },
  { bucket: 'left-back', plural: 'left-backs' },
  { bucket: 'defensive midfielder', plural: 'defensive midfielders' },
  { bucket: 'central midfielder', plural: 'central midfielders' },
  { bucket: 'attacking midfielder', plural: 'attacking midfielders' },
  { bucket: 'winger', plural: 'wingers' },
  { bucket: 'striker', plural: 'strikers' },
]

// Every spelling on file, lower-cased, with the two that are not football at
// all left out — "prop" and "defensive end" are a rugby player and an
// American footballer who were scraped by mistake, and a bucket would make
// them eligible for a board rather than visible as the errors they are.
const BUCKET_OF: Record<string, PositionBucket> = {
  goalkeeper: 'goalkeeper',
  // One player, Petr Čech, whose infobox says this because he also plays ice
  // hockey. Left in the map rather than fixed in his row because the next
  // scrape would put it back.
  goaltender: 'goalkeeper',

  // A wing-back is a full-back who is asked to get forward; the room calling
  // for right-backs means him too.
  'right-back': 'right-back',
  'right back': 'right-back',
  'right wing-back': 'right-back',
  'left-back': 'left-back',
  'left back': 'left-back',
  'left wing-back': 'left-back',
  'left wing back': 'left-back',

  'centre-back': 'centre-back',
  'centre back': 'centre-back',
  'center-back': 'centre-back',
  'centre-half': 'centre-back',
  'central defender': 'centre-back',
  // Nobody has played sweeper in thirty years and nobody will shout for one,
  // but the dozen players written that way were centre-halves.
  sweeper: 'centre-back',

  'defensive midfielder': 'defensive midfielder',
  'central midfielder': 'central midfielder',
  'attacking midfielder': 'attacking midfielder',
  'right attacking midfielder': 'attacking midfielder',

  // A left midfielder in a flat four is the left winger, whatever the
  // formation diagram called him, and a room will shout the same names for
  // both.
  winger: 'winger',
  'left winger': 'winger',
  'right winger': 'winger',
  'left midfielder': 'winger',
  'right midfielder': 'winger',
  'wide midfielder': 'winger',
  'outside right': 'winger',

  striker: 'striker',
  // 385 rows say this and nothing else, which is the single commonest
  // spelling in the whole column. Left out, it took Mark Bright off every
  // position board in the game — "Forward" is all his row has ever said,
  // and he led Sheffield Wednesday's line for four years. A handful of
  // these were really wingers; they are on the striker boards now, which
  // is a far smaller wrong than the 254 centre-forwards who were on
  // nothing.
  forward: 'striker',
  'second striker': 'striker',
  'centre forward': 'striker',
  'centre-forward': 'striker',
  'inside forward': 'striker',
}

/**
 * The buckets a player belongs to, from whatever their row says.
 *
 * `custom_position` wins when it is set: somebody looked at that player and
 * corrected the scrape.
 */
export function positionBuckets(
  customPosition: string | null,
  position: string | null,
  prosePosition: string | null = null,
): PositionBucket[] {
  const field = customPosition?.trim() ? customPosition : position
  const read = (from: string | null, into: Set<PositionBucket>) => {
    for (const raw of (from ?? '').split(/[,/]/)) {
      const bucket = BUCKET_OF[raw.trim().toLowerCase()]
      if (bucket) into.add(bucket)
    }
  }
  const found = new Set<PositionBucket>()
  read(field, found)
  // Only into a silence. The infobox is a fact about the player and the
  // prose is a reading of a paragraph, so the reading never overrules the
  // fact — it answers where the fact declined to. A hand-set
  // `custom_position` outranks both, because somebody looked.
  if (found.size === 0 && !customPosition?.trim()) read(prosePosition, found)
  // Keeping goal is the one job that is exclusive. No row mixes it with an
  // outfield position today, so this changes nothing — it is here because
  // `all_positions` is full of exactly that mistake, which is what this
  // whole module exists to keep off the board, and the day a rescrape writes
  // "Goalkeeper, Centre-back" into `position` is not the day to find out
  // that Seaman is eligible at centre-half.
  if (found.has('goalkeeper')) return ['goalkeeper']
  return POSITION_BUCKETS.map((b) => b.bucket).filter((b) => found.has(b))
}

/**
 * The same thing as something SQL can ask about.
 *
 * Delimited at both ends so `LIKE '%|winger|%'` cannot match a bucket by
 * being a prefix of another — which now matters, because "central
 * midfielder" and "centre-back" share a start and several buckets are
 * substrings of nothing by luck rather than by design.
 */
export function positionBucketKey(
  customPosition: string | null,
  position: string | null,
  prosePosition: string | null = null,
): string {
  const buckets = positionBuckets(customPosition, position, prosePosition)
  return buckets.length ? `|${buckets.join('|')}|` : ''
}
