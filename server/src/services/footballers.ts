import { eq, sql } from "drizzle-orm";
import { db, sqlite } from "../db/client.ts";
import { footballers, career_stints, career_statistics } from "../db/schema.ts";
import type { ScrapeResult, LeagueStatRow } from "./scraper.ts";
import { splitName } from "./nameSplit.ts";

// Recompute first_name/surname for one player from their display name.
// Never touches a split an admin has confirmed.
export async function applyNameSplit(
  id: number,
  name: string,
  nationality: string | null,
): Promise<void> {
  const [row] = await db
    .select({ confirmed: footballers.name_confirmed })
    .from(footballers)
    .where(eq(footballers.id, id))
    .limit(1);
  if (row?.confirmed) return;

  const s = splitName(name, nationality);
  await db
    .update(footballers)
    .set({
      first_name: s.first_name,
      surname: s.surname,
      name_ambiguous: s.ambiguous ? 1 : 0,
      name_split_reason: s.reason,
    })
    .where(eq(footballers.id, id));
}

// Replace a player's per-league career statistics (from the Wikipedia "Career
// statistics" table). Shared by insertScrapedFootballer, rescrape, and backfill.
export async function replaceCareerStatistics(
  footballerId: number,
  rows: LeagueStatRow[],
): Promise<void> {
  await db.delete(career_statistics).where(eq(career_statistics.footballer_id, footballerId));
  if (rows.length > 0) {
    // "Primera División" is the top flight in Argentina, Chile, Peru, Colombia
    // and more as well as (historically) Spain, so the name alone can't decide
    // the league. Resolve it by club: treat it as La Liga only if that club
    // appears with a La Liga division elsewhere in the table.
    for (const r of rows) {
      if (r.division && /^primera divisi[oó]n$/i.test(r.division.trim())) {
        const bare = r.club.replace(/ \(loan\)$/, "");
        const spanish = sqlite
          .prepare(
            `SELECT 1 FROM career_statistics
             WHERE REPLACE(club, ' (loan)', '') = ?
               AND LOWER(REPLACE(division, ' ', '')) = 'laliga' LIMIT 1`,
          )
          .get(bare);
        r.league = spanish ? "La Liga" : r.division;
      }
    }
  }
  if (rows.length > 0) {
    await db.insert(career_statistics).values(
      rows.map((r) => ({
        footballer_id: footballerId,
        sort_order: r.sort_order,
        club: r.club,
        club_wikipedia_url: r.club_wikipedia_url,
        season: r.season,
        division: r.division,
        league: r.league,
        league_apps: r.league_apps,
        league_goals: r.league_goals,
        total_apps: r.total_apps,
        total_goals: r.total_goals,
      })),
    );
  }
}

// Best-effort player thumbnail from TheSportsDB (used as a last-resort fallback
// when Wikipedia has no photo and none is already stored).
export async function fetchSportsDbPhoto(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`,
      { headers: { "User-Agent": "GuessTheCareer-Admin/1.0" } },
    );
    const data = (await res.json()) as { player?: { strThumb?: string }[] };
    return data?.player?.[0]?.strThumb ?? null;
  } catch {
    return null;
  }
}

// Single canonical write path for a scrape result: update every footballer field
// (including honors) and replace the player's career stints. Used by the
// single-player rescrape, the bulk "rescrape all" stream, and the standalone
// rescrape script so they can never diverge. Stint club names are already
// alias-normalized by scrapeWikipedia(), so replacing stints here canonicalizes
// them (e.g. "Borussia Dortmund" → "Dortmund").
export async function applyScrapeResult(
  id: number,
  result: ScrapeResult,
  existingPhotoUrl: string | null,
): Promise<void> {
  const photoUrl =
    existingPhotoUrl ?? result.photo_url ?? (await fetchSportsDbPhoto(result.name));

  await db
    .update(footballers)
    .set({
      name: result.name,
      nationality: result.nationality,
      full_name: result.full_name ?? null,
      birthplace: result.birthplace ?? null,
      position: result.position,
      all_positions: result.all_positions ?? null,
      style_of_play: result.style_of_play ?? null,
      born: result.born,
      height_cm: result.height_cm,
      photo_url: photoUrl,
      honors_champions_league: result.honors_champions_league,
      honors_fa_cup: result.honors_fa_cup,
      honors_league_cup: result.honors_league_cup,
      honors_club_world_cup: result.honors_club_world_cup,
      honors_world_cup: result.honors_world_cup,
      honors_euros: result.honors_euros,
      honors_copa_america: result.honors_copa_america,
      honors_ballon_dor: result.honors_ballon_dor,
      honors_world_player: result.honors_world_player,
      updated_at: sql`(datetime('now'))`,
    })
    .where(eq(footballers.id, id));

  await db.delete(career_stints).where(eq(career_stints.footballer_id, id));
  if (result.stints.length > 0) {
    await db.insert(career_stints).values(
      result.stints.map((s, i) => ({ ...s, sort_order: i, footballer_id: id })),
    );
  }

  await replaceCareerStatistics(id, result.league_stats ?? []);
  await applyNameSplit(id, result.name, result.nationality);
}
