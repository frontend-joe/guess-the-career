import { and, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { footballers, career_statistics } from "../db/schema.ts";
import { scrapeWikipedia } from "./scraper.ts";
import { replaceCareerStatistics, fetchSportsDbPhoto } from "./footballers.ts";

// Server-side background backfill jobs.
//
// These run on the server (Railway) independently of the HTTP request that
// starts them, so they survive the Netlify proxy (which buffers/times out SSE),
// browser tab closes, and long runtimes. The client starts a job with a short
// POST and polls a short GET for progress.

export type BackfillType = "photos" | "career-stats";

export interface BackfillStatus {
  type: BackfillType | null;
  running: boolean;
  total: number;
  done: number;
  updated: number; // photos filled / players that got stats
  failed: number;
  startedAt: string | null;
  finishedAt: string | null;
  currentName: string | null;
  error: string | null;
}

let job: BackfillStatus = {
  type: null,
  running: false,
  total: 0,
  done: 0,
  updated: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  currentName: null,
  error: null,
};

let cancelRequested = false;

export function getBackfillStatus(): BackfillStatus {
  return { ...job };
}

export function stopBackfill(): boolean {
  if (!job.running) return false;
  cancelRequested = true;
  return true;
}

// Targets for each job type. `onlyMissing` lets a re-run resume where it left
// off after a restart (skip players already done).
async function selectTargets(
  type: BackfillType,
  onlyMissing: boolean,
): Promise<{ id: number; name: string; url: string }[]> {
  if (type === "photos") {
    const where = onlyMissing
      ? and(
          isNotNull(footballers.wikipedia_url),
          sql`(${footballers.photo_url} IS NULL OR ${footballers.photo_url} = '')`,
        )
      : isNotNull(footballers.wikipedia_url);
    return db
      .select({ id: footballers.id, name: footballers.name, url: footballers.wikipedia_url })
      .from(footballers)
      .where(where)
      .orderBy(footballers.id) as Promise<{ id: number; name: string; url: string }[]>;
  }

  // career-stats
  if (onlyMissing) {
    const withStats = db
      .select({ id: career_statistics.footballer_id })
      .from(career_statistics);
    return db
      .select({ id: footballers.id, name: footballers.name, url: footballers.wikipedia_url })
      .from(footballers)
      .where(and(isNotNull(footballers.wikipedia_url), notInArray(footballers.id, withStats)))
      .orderBy(footballers.id) as Promise<{ id: number; name: string; url: string }[]>;
  }
  return db
    .select({ id: footballers.id, name: footballers.name, url: footballers.wikipedia_url })
    .from(footballers)
    .where(isNotNull(footballers.wikipedia_url))
    .orderBy(footballers.id) as Promise<{ id: number; name: string; url: string }[]>;
}

// Start a backfill. Returns false if one is already running.
export function startBackfill(type: BackfillType, onlyMissing = true): boolean {
  if (job.running) return false;
  cancelRequested = false;
  job = {
    type,
    running: true,
    total: 0,
    done: 0,
    updated: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    currentName: null,
    error: null,
  };

  // Fire-and-forget: runs independently of the request.
  void (async () => {
    try {
      const targets = await selectTargets(type, onlyMissing);
      job.total = targets.length;
      for (const player of targets) {
        if (cancelRequested) break;
        job.currentName = player.name;
        try {
          const result = await scrapeWikipedia(player.url);
          if (type === "photos") {
            const photo = result.photo_url ?? (await fetchSportsDbPhoto(result.name));
            if (photo) {
              await db
                .update(footballers)
                .set({ photo_url: photo, updated_at: sql`(datetime('now'))` })
                .where(eq(footballers.id, player.id));
              job.updated += 1;
            }
          } else {
            const rows = result.league_stats ?? [];
            await replaceCareerStatistics(player.id, rows);
            if (rows.length > 0) job.updated += 1;
          }
        } catch {
          job.failed += 1;
        }
        job.done += 1;
        await new Promise<void>((r) => setTimeout(r, 600));
      }
    } catch (e) {
      job.error = e instanceof Error ? e.message : "Backfill failed";
    } finally {
      job.running = false;
      job.currentName = null;
      job.finishedAt = new Date().toISOString();
      cancelRequested = false;
    }
  })();

  return true;
}
