// Chat moderation: a filter the server applies before anyone else sees a
// message.
//
// Deliberately small and deliberately honest about what it is. This catches
// slurs and the hardest profanity, masks them, and records that it did. It is
// not a content-understanding system and will never catch someone being vile
// in a way it has no word for — the report route exists for that, and the host
// can remove a player outright.
//
// Why a word list and not a service: four friends in a private room generate a
// handful of messages a game. Posting each one to a third-party classifier
// would send their chat to a company that currently never sees it, add a
// network round trip to a message that should feel instant, and buy very
// little over this.
//
// Matching is on whole words against a normalised copy, so "classic" is not
// caught for containing a word it merely contains. That bug — the Scunthorpe
// problem — is the single most common way a filter like this embarrasses
// itself.

/// The deliberately short list: slurs and the strongest profanity. Mild
/// swearing is left alone, because this is a football game played in a pub and
/// a filter that bleeps "bloody" trains people to ignore it.
const BLOCKED = [
  'nigger', 'nigga', 'faggot', 'fag', 'tranny', 'kike', 'spic', 'chink',
  'paki', 'wetback', 'coon', 'retard', 'retarded', 'cunt', 'rapist',
]

/// Letters that get swapped for digits and symbols to slip a word past a
/// filter. Normalising them is what makes the list worth having at all.
const LOOKALIKES: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i',
}

function normalise(word: string): string {
  return word
    .toLowerCase()
    .split('')
    .map((ch) => LOOKALIKES[ch] ?? ch)
    .join('')
    // Repeated letters, so "cuuuunt" normalises to the same thing.
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z]/g, '')
}

const BLOCKED_SET = new Set(BLOCKED.map(normalise))

export interface Moderated {
  body: string
  /// True when the text was changed, which is what gets recorded alongside the
  /// original so the filter can be checked later.
  moderated: boolean
}

/// Mask anything on the list, preserving the shape of the message so the
/// person reading it can see that something was removed rather than quietly
/// receiving a different sentence.
export function moderateMessage(body: string): Moderated {
  let moderated = false
  const cleaned = body.replace(/[\p{L}\p{N}@$!]+/gu, (word) => {
    if (!BLOCKED_SET.has(normalise(word))) return word
    moderated = true
    return '*'.repeat(word.length)
  })
  return { body: cleaned, moderated }
}
