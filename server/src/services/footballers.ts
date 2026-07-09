import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { footballers, career_stints } from "../db/schema.ts";
import type { ScrapeResult } from "./scraper.ts";

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
}
