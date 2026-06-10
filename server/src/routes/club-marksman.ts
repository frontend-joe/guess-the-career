import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, sqlite, normalizeName } from "../db/client.ts";
import { footballers, career_stints } from "../db/schema.ts";
import {
  CLUB_ALIASES,
  normalizeClubAlias,
  scrapeWikipedia,
  isRetired,
} from "../services/scraper.ts";

export const clubMarksmanRouter = new Hono();

// Tuning these thresholds later is a one-liner.
const MIN_GOALS = 50;
const MIN_MARKSMEN = 5;

// Build the full list of club name variants (canonical + all aliases + loan-prefix forms)
function getClubVariants(clubName: string): string[] {
  const canonical = normalizeClubAlias(clubName);
  const aliases = Object.entries(CLUB_ALIASES)
    .filter(([, v]) => v === canonical)
    .map(([k]) => k);
  const base = [canonical, ...aliases];
  return [...base, ...base.map((v) => `→ ${v}`)];
}

function hasClub(stintClubs: string[], targetClub: string): boolean {
  const variants = getClubVariants(targetClub);
  return stintClubs.some((c) => variants.includes(normalizeClubAlias(c)));
}

// Sum senior goals at the target club across all spells.
function sumClubGoals(
  stints: { club: string; goals: number | null }[],
  targetClub: string,
): number {
  const variants = getClubVariants(targetClub);
  let total = 0;
  for (const s of stints) {
    if (variants.includes(normalizeClubAlias(s.club))) total += s.goals ?? 0;
  }
  return total;
}

const reserveRe =
  /\s(B|C|II|III|IV|reserves?|under[- ]?\d+|u\d+|youth|academy)$/i;

interface StintRow {
  footballer_id: number;
  club: string;
  goals: number | null;
}

// Returns [canonicalClubName, marksmanCount] for every club with >= MIN_MARKSMEN
// players who have >= MIN_GOALS total senior goals for that club.
function findValidClubs(): [string, number][] {
  const rows = sqlite
    .prepare(
      `SELECT footballer_id, club, goals FROM career_stints WHERE stint_type = 'senior'`,
    )
    .all() as StintRow[];

  // club -> (footballer_id -> summed goals)
  const clubMap = new Map<string, Map<number, number>>();
  for (const { footballer_id, club, goals } of rows) {
    const canonical = normalizeClubAlias(club);
    if (reserveRe.test(canonical.trim())) continue;
    if (!clubMap.has(canonical)) clubMap.set(canonical, new Map());
    const players = clubMap.get(canonical)!;
    players.set(footballer_id, (players.get(footballer_id) ?? 0) + (goals ?? 0));
  }

  const valid: [string, number][] = [];
  for (const [club, players] of clubMap) {
    let marksmen = 0;
    for (const total of players.values()) {
      if (total >= MIN_GOALS) marksmen++;
    }
    if (marksmen >= MIN_MARKSMEN) valid.push([club, marksmen]);
  }
  return valid;
}

function clubWikiUrl(club: string): string | null {
  const row = sqlite
    .prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`)
    .get(club) as { wikipedia_url: string | null } | undefined;
  return row?.wikipedia_url ?? null;
}

interface MarksmanPlayer {
  id: number;
  name: string;
  photo_url: string | null;
  goals: number;
  nationality: string | null;
  position: string | null;
}

// All players with >= MIN_GOALS summed senior goals for the club.
function getClubMarksmen(club: string): MarksmanPlayer[] {
  const variants = getClubVariants(club).map((v) => v.toLowerCase());
  const ph = variants.map(() => "?").join(", ");
  const rows = sqlite
    .prepare(
      `
    SELECT f.id, f.name, f.photo_url, f.nationality, f.position,
           SUM(COALESCE(cs.goals, 0)) as total_goals
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id
      AND cs.stint_type = 'senior'
      AND LOWER(cs.club) IN (${ph})
    GROUP BY f.id
    HAVING total_goals >= ${MIN_GOALS}
    ORDER BY total_goals DESC, f.name ASC
  `,
    )
    .all(...variants) as {
    id: number;
    name: string;
    photo_url: string | null;
    nationality: string | null;
    position: string | null;
    total_goals: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    photo_url: r.photo_url,
    goals: r.total_goals,
    nationality: r.nationality,
    position: r.position,
  }));
}

// GET /api/club-marksman/admin/clubs
clubMarksmanRouter.get("/admin/clubs", (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(c.req.query("pageSize") ?? "25", 10)),
  );

  const validClubs = findValidClubs();

  // Seed all clubs as enabled on first visit (when the table is empty).
  const existingCount = (
    sqlite
      .prepare(`SELECT COUNT(*) as n FROM club_marksman_enabled_clubs`)
      .get() as { n: number }
  ).n;
  if (existingCount === 0 && validClubs.length > 0) {
    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO club_marksman_enabled_clubs (club) VALUES (?)`,
    );
    const insertMany = sqlite.transaction((clubs: string[]) => {
      for (const club of clubs) insert.run(club);
    });
    insertMany(validClubs.map(([club]) => club));
  }

  const enabledRows = sqlite
    .prepare(`SELECT club FROM club_marksman_enabled_clubs`)
    .all() as { club: string }[];
  const enabledSet = new Set(enabledRows.map((r) => r.club));

  const sorted = validClubs.sort((a, b) => b[1] - a[1]);
  const total = sorted.length;
  const enabledCount = sorted.filter(([club]) => enabledSet.has(club)).length;
  const page_data = sorted.slice((page - 1) * pageSize, page * pageSize);

  const data = page_data.map(([club, marksmanCount]) => ({
    club,
    clubWikiUrl: clubWikiUrl(club),
    marksmanCount,
    enabled: enabledSet.has(club),
  }));

  return c.json({ data, total, enabledCount, page, pageSize });
});

// GET /api/club-marksman/admin/clubs/:club/players — accordion payload
clubMarksmanRouter.get("/admin/clubs/:club/players", (c) => {
  const club = c.req.param("club");
  return c.json(getClubMarksmen(club));
});

// POST /api/club-marksman/admin/clubs/enable
clubMarksmanRouter.post(
  "/admin/clubs/enable",
  zValidator("json", z.object({ club: z.string().min(1) })),
  (c) => {
    const { club } = c.req.valid("json");
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO club_marksman_enabled_clubs (club) VALUES (?)`,
      )
      .run(normalizeClubAlias(club));
    return c.json({ ok: true });
  },
);

// DELETE /api/club-marksman/admin/clubs/enable
clubMarksmanRouter.delete(
  "/admin/clubs/enable",
  zValidator("json", z.object({ club: z.string().min(1) })),
  (c) => {
    const { club } = c.req.valid("json");
    sqlite
      .prepare(`DELETE FROM club_marksman_enabled_clubs WHERE LOWER(club) = LOWER(?)`)
      .run(normalizeClubAlias(club));
    return c.json({ ok: true });
  },
);

// GET /api/club-marksman/schedule — admin list
clubMarksmanRouter.get("/schedule", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT id, date, club, created_at FROM club_marksman_schedule ORDER BY date ASC`,
    )
    .all() as {
    id: number;
    date: string;
    club: string;
    created_at: string;
  }[];
  return c.json(rows);
});

// GET /api/club-marksman/schedule/rounds — game data with wiki URLs + counts
clubMarksmanRouter.get("/schedule/rounds", (c) => {
  const scheduled = sqlite
    .prepare(`SELECT date, club FROM club_marksman_schedule ORDER BY date ASC`)
    .all() as { date: string; club: string }[];

  if (scheduled.length === 0) return c.json([]);

  const countMap = new Map<string, number>();
  for (const [club, count] of findValidClubs()) countMap.set(club, count);

  const rounds = scheduled.map((row) => ({
    date: row.date,
    club: row.club,
    clubWikiUrl: clubWikiUrl(row.club),
    marksmanCount: countMap.get(normalizeClubAlias(row.club)) ?? 0,
  }));

  return c.json(rounds);
});

// PUT /api/club-marksman/schedule/:date
clubMarksmanRouter.put(
  "/schedule/:date",
  zValidator("json", z.object({ club: z.string().min(1) })),
  (c) => {
    const date = c.req.param("date");
    const { club } = c.req.valid("json");
    const existing = sqlite
      .prepare(`SELECT id FROM club_marksman_schedule WHERE date = ?`)
      .get(date);
    if (existing) {
      sqlite
        .prepare(`UPDATE club_marksman_schedule SET club = ? WHERE date = ?`)
        .run(club, date);
    } else {
      sqlite
        .prepare(`INSERT INTO club_marksman_schedule (date, club) VALUES (?, ?)`)
        .run(date, club);
    }
    return c.json({ ok: true });
  },
);

// DELETE /api/club-marksman/schedule/:date
clubMarksmanRouter.delete("/schedule/:date", (c) => {
  const date = c.req.param("date");
  sqlite.prepare(`DELETE FROM club_marksman_schedule WHERE date = ?`).run(date);
  return c.json({ ok: true });
});

// DELETE /api/club-marksman/schedule
clubMarksmanRouter.delete("/schedule", (c) => {
  sqlite.prepare(`DELETE FROM club_marksman_schedule`).run();
  return c.json({ ok: true });
});

// GET /api/club-marksman/answers?club=Y
clubMarksmanRouter.get("/answers", (c) => {
  const club = c.req.query("club") ?? "";
  if (!club) return c.json({ error: "club required" }, 400);
  return c.json(getClubMarksmen(club));
});

// POST /api/club-marksman/verify
clubMarksmanRouter.post(
  "/verify",
  zValidator(
    "json",
    z.object({
      footballerName: z.string().min(1),
      footballerId: z.number().int().nullish(),
      club: z.string().min(1),
    }),
  ),
  async (c) => {
    const { footballerName, footballerId, club } = c.req.valid("json");

    function checkQualifies(
      stints: { club: string; goals: number | null }[],
    ): boolean {
      return sumClubGoals(stints, club) >= MIN_GOALS;
    }

    type FailReason = "wrong_club" | "not_enough_goals";
    function invalidJson(
      name: string,
      stints: { club: string; goals: number | null }[],
    ) {
      const stintClubs = stints.map((s) => s.club);
      const reason: FailReason = hasClub(stintClubs, club)
        ? "not_enough_goals"
        : "wrong_club";
      return {
        valid: false as const,
        foundName: name,
        goalsAtClub: sumClubGoals(stints, club),
        imported: false,
        reason,
      };
    }

    // Step 1: resolve footballer from DB
    let footballer:
      | {
          id: number;
          name: string;
          wikipedia_url: string;
          photo_url: string | null;
        }
      | undefined;

    if (footballerId != null) {
      footballer = await db
        .select({
          id: footballers.id,
          name: footballers.name,
          wikipedia_url: footballers.wikipedia_url,
          photo_url: footballers.photo_url,
        })
        .from(footballers)
        .where(eq(footballers.id, footballerId))
        .limit(1)
        .then((r) => r[0]);
    }

    if (!footballer) {
      const normalizedName = normalizeName(footballerName);
      footballer = await db
        .select({
          id: footballers.id,
          name: footballers.name,
          wikipedia_url: footballers.wikipedia_url,
          photo_url: footballers.photo_url,
        })
        .from(footballers)
        .where(
          sql`LOWER(normalize(${footballers.name})) = LOWER(normalize(${footballerName}))`,
        )
        .limit(1)
        .then((r) => r[0]);

      if (!footballer) {
        footballer = await db
          .select({
            id: footballers.id,
            name: footballers.name,
            wikipedia_url: footballers.wikipedia_url,
            photo_url: footballers.photo_url,
          })
          .from(footballers)
          .where(sql`normalize(${footballers.name}) = ${normalizedName}`)
          .limit(1)
          .then((r) => r[0]);
      }
    }

    // If no candidate qualifies, this holds the most relevant "why not" reason.
    let fallbackInvalid: ReturnType<typeof invalidJson> | null = null;

    // Step 2: if found, check stints
    if (footballer) {
      let stints = await db
        .select({ club: career_stints.club, goals: career_stints.goals })
        .from(career_stints)
        .where(
          sql`${career_stints.footballer_id} = ${footballer.id} AND ${career_stints.stint_type} = 'senior'`,
        );

      if (checkQualifies(stints)) {
        return c.json({
          valid: true,
          footballer: {
            id: footballer.id,
            name: footballer.name,
            photo_url: footballer.photo_url,
          },
          imported: false,
        });
      }

      // Stints might be stale — rescrape
      if (footballer.wikipedia_url) {
        try {
          const scraped = await scrapeWikipedia(footballer.wikipedia_url);
          const seniorStints = scraped.stints.filter(
            (s) => s.stint_type === "senior",
          );
          for (const s of seniorStints) {
            const existing = sqlite
              .prepare(
                `SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = 'senior' LIMIT 1`,
              )
              .get(footballer.id, s.years, s.club);
            if (!existing) {
              const maxOrder = sqlite
                .prepare(
                  `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`,
                )
                .get(footballer.id) as { next: number };
              await db.insert(career_stints).values({
                footballer_id: footballer.id,
                sort_order: maxOrder.next,
                years: s.years,
                club: s.club,
                club_wikipedia_url: s.club_wikipedia_url ?? null,
                apps: s.apps ?? null,
                goals: s.goals ?? null,
                stint_type: "senior",
              });
            }
          }
          stints = await db
            .select({ club: career_stints.club, goals: career_stints.goals })
            .from(career_stints)
            .where(
              sql`${career_stints.footballer_id} = ${footballer.id} AND ${career_stints.stint_type} = 'senior'`,
            );
          if (checkQualifies(stints)) {
            return c.json({
              valid: true,
              footballer: {
                id: footballer.id,
                name: footballer.name,
                photo_url: footballer.photo_url,
              },
              imported: true,
            });
          }
        } catch {
          // fall through to Wikipedia search
        }
      }

      // This DB record matches the typed name. If they genuinely played for the
      // club, report on them (e.g. not enough goals) rather than chasing a
      // same-named player on Wikipedia. Otherwise keep their mismatch as a
      // fallback but still let a namesake qualify below.
      if (hasClub(stints.map((s) => s.club), club)) {
        return c.json(invalidJson(footballer.name, stints));
      }
      fallbackInvalid = invalidJson(footballer.name, stints);
    }

    // Step 3: not in DB — try Wikipedia name search
    try {
      const wikiHeaders = { "User-Agent": "GuessTheCareer-Admin/1.0" };
      const stripDiacritics = normalizeName;
      const nameParts = stripDiacritics(footballerName)
        .split(/\s+/)
        .filter((p) => p.length > 2);
      function titleMatchesName(title: string) {
        const t = stripDiacritics(title);
        return nameParts.length > 0 && nameParts.every((p) => t.includes(p));
      }
      async function wikiSearch(query: string): Promise<string[]> {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
        const res = await fetch(url, { headers: wikiHeaders });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          query?: { search?: { title: string }[] };
        };
        return (data.query?.search ?? []).map((s) => s.title);
      }

      // Gather candidate titles across queries (a name can match several people).
      const candidateTitles: string[] = [];
      for (const query of [
        footballerName + " footballer",
        footballerName + " " + club,
        footballerName,
      ]) {
        for (const title of await wikiSearch(query)) {
          if (titleMatchesName(title) && !candidateTitles.includes(title)) {
            candidateTitles.push(title);
          }
        }
      }

      if (candidateTitles.length === 0)
        return c.json(
          fallbackInvalid ?? { valid: false, footballer: null, imported: false },
        );

      for (const title of candidateTitles.slice(0, 6)) {
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

        const byUrl = await db
          .select({
            id: footballers.id,
            name: footballers.name,
            photo_url: footballers.photo_url,
          })
          .from(footballers)
          .where(eq(footballers.wikipedia_url, wikiUrl))
          .limit(1)
          .then((r) => r[0]);

        if (byUrl) {
          const stints = await db
            .select({ club: career_stints.club, goals: career_stints.goals })
            .from(career_stints)
            .where(
              sql`${career_stints.footballer_id} = ${byUrl.id} AND ${career_stints.stint_type} = 'senior'`,
            );
          if (checkQualifies(stints)) {
            return c.json({
              valid: true,
              footballer: {
                id: byUrl.id,
                name: byUrl.name,
                photo_url: byUrl.photo_url,
              },
              imported: false,
            });
          }
        }

        await new Promise((r) => setTimeout(r, 300));
        let scraped;
        try {
          scraped = await scrapeWikipedia(wikiUrl);
        } catch {
          continue;
        }
        const seniorStints = scraped.stints.filter(
          (s) => s.stint_type === "senior",
        );
        const scrapedStints = seniorStints.map((s) => ({
          club: s.club,
          goals: s.goals ?? null,
        }));

        if (!checkQualifies(scrapedStints)) {
          fallbackInvalid ??= invalidJson(scraped.name, scrapedStints);
          continue;
        }
        if (!isRetired(scraped.stints)) {
          return c.json({
            valid: false,
            foundName: scraped.name,
            imported: false,
            reason: "not_retired" as const,
          });
        }

        const knownRecord = byUrl ?? footballer;
        if (knownRecord) {
          sqlite
            .prepare(
              `UPDATE footballers SET wikipedia_url = ?, photo_url = COALESCE(photo_url, ?) WHERE id = ?`,
            )
            .run(wikiUrl, scraped.photo_url ?? null, knownRecord.id);
          for (const s of seniorStints) {
            const existing = sqlite
              .prepare(
                `SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = 'senior' LIMIT 1`,
              )
              .get(knownRecord.id, s.years, s.club);
            if (!existing) {
              const maxOrder = sqlite
                .prepare(
                  `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`,
                )
                .get(knownRecord.id) as { next: number };
              await db.insert(career_stints).values({
                footballer_id: knownRecord.id,
                sort_order: maxOrder.next,
                years: s.years,
                club: s.club,
                club_wikipedia_url: s.club_wikipedia_url ?? null,
                apps: s.apps ?? null,
                goals: s.goals ?? null,
                stint_type: "senior",
              });
            }
          }
          return c.json({
            valid: true,
            footballer: {
              id: knownRecord.id,
              name: knownRecord.name,
              photo_url: scraped.photo_url ?? knownRecord.photo_url,
            },
            imported: true,
          });
        }

        // Truly new footballer — insert
        const [newFootballer] = await db
          .insert(footballers)
          .values({
            name: scraped.name,
            wikipedia_url: scraped.wikipedia_url,
            nationality: scraped.nationality,
            position: scraped.position,
            all_positions: scraped.all_positions ?? null,
            born: scraped.born,
            photo_url: scraped.photo_url ?? null,
          })
          .returning();

        if (seniorStints.length > 0) {
          await db.insert(career_stints).values(
            seniorStints.map((s, i) => ({
              footballer_id: newFootballer.id,
              sort_order: i,
              years: s.years,
              club: s.club,
              club_wikipedia_url: s.club_wikipedia_url ?? null,
              apps: s.apps ?? null,
              goals: s.goals ?? null,
              stint_type: "senior" as const,
            })),
          );
        }

        return c.json({
          valid: true,
          footballer: {
            id: newFootballer.id,
            name: newFootballer.name,
            photo_url: newFootballer.photo_url ?? null,
          },
          imported: true,
        });
      }

      return c.json(
        fallbackInvalid ?? { valid: false, footballer: null, imported: false },
      );
    } catch {
      return c.json({ valid: false, footballer: null, imported: false });
    }
  },
);
