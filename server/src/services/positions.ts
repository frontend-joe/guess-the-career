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
// player belongs to as many as their position says. That is the point: the
// WHOLE field decides, not the first word of it. Dennis Bergkamp is
// "Forward, attacking midfielder", so he is on the forwards board and on the
// midfielders board, because he was both.
//
// The `all_positions` column is deliberately not read, though it is the
// richer one. It lists every position a player ever occupied, including the
// afternoon they went in goal: it has Ronaldo, Scholes, Drogba, Puyol and
// Neymar down as goalkeepers, and it put Piqué, Figo, Eto'o, Romário and
// Ibrahimović on Barcelona's midfielders board. Only two players on file
// have no `position` at all and neither has an `all_positions` either, so it
// adds nothing except names that make the board look wrong when it is
// revealed. A board that misses a versatile player's second job is a smaller
// failure than one that claims Ronaldo kept goal.

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
 * `custom_position` wins when it is set: somebody looked at that player and
 * corrected the scrape.
 */
export function positionBuckets(
  customPosition: string | null,
  position: string | null,
): PositionBucket[] {
  const field = customPosition?.trim() ? customPosition : position
  const found = new Set<PositionBucket>()
  for (const raw of (field ?? '').split(/[,/]/)) {
    const bucket = BUCKET_OF[raw.trim().toLowerCase()]
    if (bucket) found.add(bucket)
  }
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
 * Delimited at both ends so `LIKE '%|forward|%'` cannot match a bucket by
 * being a prefix of another. Nothing in the four currently is, but a key that
 * only works because of the words chosen is a trap for whoever adds the
 * fifth.
 */
export function positionBucketKey(
  customPosition: string | null,
  position: string | null,
): string {
  const buckets = positionBuckets(customPosition, position)
  return buckets.length ? `|${buckets.join('|')}|` : ''
}
