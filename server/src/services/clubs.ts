import { sqlite } from "../db/client.ts";
import { normalizeClubAlias } from "./scraper.ts";

// Resolve a club's Wikipedia URL from the curated clubs table, trying the raw
// name and its normalized alias (and stripping loan/→ markers). Used as a
// fallback when a stint didn't store its own club link — e.g. "Dortmund", whose
// article is "Borussia Dortmund", so the bare name can't resolve a crest.
export function clubWikiUrl(club: string): string | null {
  const clean = club
    .replace(/^→\s*/, "")
    .replace(/\s*\((loan|trial|co-ownership)\)\s*$/i, "")
    .trim();
  for (const name of [clean, normalizeClubAlias(clean)]) {
    const row = sqlite
      .prepare(
        `SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) AND wikipedia_url IS NOT NULL LIMIT 1`,
      )
      .get(name) as { wikipedia_url: string | null } | undefined;
    if (row?.wikipedia_url) return row.wikipedia_url;
  }
  return null;
}
