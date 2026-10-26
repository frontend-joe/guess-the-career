import { sqlite } from "../db/client.ts";
import { scrapeClubSeasons } from "./scraper.ts";

// Divisions named only in England. A club that ever appears under one of these
// is English, which is the only thing we need the country for: "Premier League"
// was also Scotland's top flight from 1998 to 2013, so that name alone can't
// say which country a season belongs to. Every other league we care about
// ("Serie A", "La Liga", "Bundesliga", "Ligue 1") is unique to its country.
const ENGLISH_ONLY_DIVISIONS = [
  "Premier League",
  "Championship",
  "Second Division",
  "Third Division",
  "Fourth Division",
  "League One",
  "League Two",
];

export function isEnglishClub(club: string): boolean {
  const row = sqlite
    .prepare(
      `SELECT 1 FROM career_statistics
       WHERE REPLACE(club, ' (loan)', '') = ?
         AND division IN (${ENGLISH_ONLY_DIVISIONS.map(() => "?").join(", ")})
       LIMIT 1`,
    )
    .get(club, ...ENGLISH_ONLY_DIVISIONS);
  return row !== undefined;
}

/**
 * Scrape one club's season-by-season division history and replace what we hold
 * for it. Returns the number of seasons stored — 0 means the club has no
 * "List of <club> seasons" article, which is common and not an error.
 */
function recordCheck(club: string, seasonsFound: number, error: string | null): void {
  sqlite
    .prepare(
      `INSERT INTO club_season_checks (club, checked_at, seasons_found, error)
       VALUES (?, datetime('now'), ?, ?)
       ON CONFLICT(club) DO UPDATE SET
         checked_at    = excluded.checked_at,
         seasons_found = excluded.seasons_found,
         error         = excluded.error`,
    )
    .run(club, seasonsFound, error);
}

export async function refreshClubSeasons(
  club: string,
  wikiUrl: string,
): Promise<number> {
  let rows;
  try {
    rows = await scrapeClubSeasons(wikiUrl, isEnglishClub(club));
  } catch (e) {
    // Record the failure and rethrow: the caller counts it, and storing the
    // error (rather than a zero count) keeps the club eligible for a retry.
    recordCheck(club, 0, e instanceof Error ? e.message : "scrape failed");
    throw e;
  }

  if (rows.length === 0) {
    recordCheck(club, 0, null);
    return 0;
  }

  const sourceUrl = `https://en.wikipedia.org/wiki/List_of_${
    decodeURIComponent(wikiUrl.split("/wiki/")[1] ?? "")
  }_seasons`;

  const replace = sqlite.transaction(() => {
    sqlite.prepare(`DELETE FROM club_seasons WHERE club = ?`).run(club);
    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO club_seasons
         (club, season, season_year, division_raw, league, source_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rows) {
      insert.run(club, r.season, r.season_year, r.division_raw, r.league, sourceUrl);
    }
  });
  replace();
  recordCheck(club, rows.length, null);

  return rows.length;
}
