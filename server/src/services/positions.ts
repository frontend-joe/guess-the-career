// Which of the four jobs on a football pitch a player did.
//
// Wikipedia infoboxes do not agree on a vocabulary. The same role is written
// "Centre-back", "Centre back", "Center-back" and "Central defender"; a
// player is "Defender" on one page and "Full-back, Centre-back, Defensive
// midfielder, Forward" on another. Thirty-nine spellings across the whole
// database, which is small enough to simply write down.
//
// Rounds ask the broad question — a room shouts Arsenal goalkeepers, not
// Arsenal sweepers — so every spelling lands in one of four buckets, and a
// player belongs to as many as their positions say. That is the point: the
// FULL position list decides, not the first entry. Dennis Bergkamp is a
// forward on a board of forwards and an attacking midfielder on a board of
// midfielders, because he was both, and a round that only read the first
// word would leave him off one of them.

export type PositionBucket = 'goalkeeper' | 'defender' | 'midfielder' | 'forward'

export const POSITION_BUCKETS: { bucket: PositionBucket; plural: string }[] = [
  { bucket: 'goalkeeper', plural: 'goalkeepers' },
  { bucket: 'defender', plural: 'defenders' },
  { bucket: 'midfielder', plural: 'midfielders' },
  { bucket: 'forward', plural: 'forwards' },
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

  defender: 'defender',
  'centre-back': 'defender',
  'centre back': 'defender',
  'center-back': 'defender',
  'centre-half': 'defender',
  'central defender': 'defender',
  sweeper: 'defender',
  'left back': 'defender',
  'left-back': 'defender',
  'right back': 'defender',
  'right-back': 'defender',
  'full-back': 'defender',
  'full back': 'defender',
  'wing-back': 'defender',
  wingback: 'defender',
  'left wing-back': 'defender',
  'right wing-back': 'defender',
  'wing half': 'defender',

  midfielder: 'midfielder',
  'attacking midfielder': 'midfielder',
  'right attacking midfielder': 'midfielder',
  'defensive midfielder': 'midfielder',
  'central midfielder': 'midfielder',
  'left midfielder': 'midfielder',
  'right midfielder': 'midfielder',
  'wide midfielder': 'midfielder',

  forward: 'forward',
  striker: 'forward',
  'second striker': 'forward',
  'centre forward': 'forward',
  'centre-forward': 'forward',
  'inside forward': 'forward',
  'outside right': 'forward',
  // A winger is an attacker, and a room naming forwards will shout them. The
  // ones who were really wide midfielders are nearly always written as both,
  // so they reach the midfield board through their other entry rather than
  // through an argument about what a winger is.
  winger: 'forward',
  'left winger': 'forward',
  'right winger': 'forward',
}

/**
 * The buckets a player belongs to, from whatever their row says.
 *
 * `custom_position` wins outright when it is set: somebody looked at that
 * player and corrected the scrape, and folding the old answer back in would
 * undo the correction. Otherwise the two scraped fields are UNIONED rather
 * than ranked. Neither contains the other — `all_positions` is richer on
 * 1,700 players and missing entirely on 1,534, while `position` carries a
 * token `all_positions` lacks on 428 of them, Matthäus's sweeper among them.
 *
 * Returned in pitch order rather than the order they were written, so the
 * value is the same for two players whose infoboxes disagree about where to
 * start.
 */
export function positionBuckets(
  customPosition: string | null,
  allPositions: string | null,
  position: string | null,
): PositionBucket[] {
  // The primary field. `all_positions` is the richer scrape and also the
  // less trustworthy one — see the goalkeeper rule below.
  const primary = customPosition?.trim() ? customPosition : position
  const source = customPosition?.trim() ? [customPosition] : [allPositions, position]

  const read = (field: string | null) => {
    const found = new Set<PositionBucket>()
    for (const raw of (field ?? '').split(/[,/]/)) {
      const bucket = BUCKET_OF[raw.trim().toLowerCase()]
      if (bucket) found.add(bucket)
    }
    return found
  }

  // Keeping goal is the one job that is exclusive, and `all_positions` does
  // not know it. It has Ronaldo, Scholes, Drogba, Puyol and Neymar down as
  // goalkeepers — sixteen outfielders in all, picked up from somewhere on a
  // long article — and in the other direction it gives Seaman and Neuer
  // "Centre-back" and Buffon "Winger", so thirty-three keepers would have
  // turned up on defender and forward boards.
  //
  // Both are the same mistake and one rule settles both: whether somebody
  // kept goal is read from the primary field alone, and if they did, that is
  // the whole of what they were. No player on file has a goalkeeping
  // all_positions and a blank primary, so nothing real is lost by insisting.
  const keeper = read(primary).has('goalkeeper')
  if (keeper) return ['goalkeeper']

  const found = new Set<PositionBucket>()
  for (const field of source) for (const b of read(field)) found.add(b)
  found.delete('goalkeeper')
  return POSITION_BUCKETS.map((b) => b.bucket).filter((b) => found.has(b))
}

/**
 * The same thing as something SQL can ask about.
 *
 * Delimited at both ends so `LIKE '%|forward|%'` cannot match a bucket by
 * being a prefix of another. Nothing in the four currently is, but a key that
 * only works because of the words chosen is a trap for whoever adds the
 * fifth.
 */
export function positionBucketKey(
  customPosition: string | null,
  allPositions: string | null,
  position: string | null,
): string {
  const buckets = positionBuckets(customPosition, allPositions, position)
  return buckets.length ? `|${buckets.join('|')}|` : ''
}
