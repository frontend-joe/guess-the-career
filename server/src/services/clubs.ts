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

const KIT_COLS = [
  "home_body",
  "home_leftarm",
  "home_rightarm",
  "home_shorts",
  "home_socks",
  "home_pattern",
] as const;

type KitRow = { name: string } & Record<(typeof KIT_COLS)[number], string | null>;

// Rebuild the curated `clubs` table from footballers' senior career stints,
// collapsing alias variants (e.g. "Borussia Dortmund"/"Dortmund") into a single
// canonical row via normalize_club_alias(). Reserve/B/youth teams are excluded.
// Manually-set kit colours are preserved by re-attaching them to the canonical
// name. Returns the resulting club count.
export function rebuildClubs(): number {
  const tx = sqlite.transaction(() => {
    // Snapshot existing kit colours, keyed by canonical (alias-normalized) name.
    const existing = sqlite
      .prepare(`SELECT name, ${KIT_COLS.join(", ")} FROM clubs`)
      .all() as KitRow[];
    const kitByCanonical = new Map<string, KitRow>();
    for (const row of existing) {
      if (!row.home_body) continue;
      const canonical = normalizeClubAlias(row.name).toLowerCase();
      if (!kitByCanonical.has(canonical)) kitByCanonical.set(canonical, row);
    }

    sqlite.prepare(`DELETE FROM clubs`).run();

    sqlite.exec(`
      INSERT INTO clubs (name, wikipedia_url)
      SELECT normalize_club_alias(club) AS norm_name, MIN(club_wikipedia_url) AS wiki_url
      FROM career_stints
      WHERE stint_type = 'senior'
        AND normalize_club_alias(club) NOT LIKE '% B'
        AND normalize_club_alias(club) NOT LIKE '% C'
        AND normalize_club_alias(club) NOT LIKE '% II'
        AND normalize_club_alias(club) != 'Bilbao Athletic'
      GROUP BY LOWER(normalize_club_alias(club))
      ON CONFLICT(name) DO UPDATE SET wikipedia_url = COALESCE(excluded.wikipedia_url, clubs.wikipedia_url)
    `);

    // Re-attach preserved kit colours to the (canonical) rebuilt rows.
    const setClause = KIT_COLS.map((col) => `${col} = ?`).join(", ");
    const upd = sqlite.prepare(
      `UPDATE clubs SET ${setClause} WHERE LOWER(name) = ?`,
    );
    for (const [canonical, kit] of kitByCanonical) {
      upd.run(...KIT_COLS.map((col) => kit[col]), canonical);
    }
  });
  tx();

  const { count } = sqlite
    .prepare(`SELECT COUNT(*) AS count FROM clubs`)
    .get() as { count: number };
  return count;
}
