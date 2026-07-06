import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, sqlite, normalizeName } from "../db/client.ts";
import { footballers, career_stints } from "../db/schema.ts";
import { normalizeClubAlias, scrapeWikipedia, isRetired } from "../services/scraper.ts";
import {
  getClubVariants,
  hasClub,
  reserveRe,
  canonicalNationality,
} from "../services/football.ts";

export const clubForeignersRouter = new Hono();

const MIN_NATIONALITIES = 10;
// The game (client) asks for 10 of the club's overseas players; the pool returned
// here is every foreign player, and the client caps the round at 10.

function clubWikiUrl(club: string): string | null {
  const row = sqlite
    .prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`)
    .get(club) as { wikipedia_url: string | null } | undefined;
  return row?.wikipedia_url ?? null;
}

// Manual home-country overrides, keyed by canonical club name.
function homeOverrides(): Map<string, string> {
  const rows = sqlite
    .prepare(`SELECT club, home_country FROM club_foreigners_home_override`)
    .all() as { club: string; home_country: string }[];
  return new Map(rows.map((r) => [r.club, r.home_country]));
}

function homeOverrideFor(club: string): string | null {
  const row = sqlite
    .prepare(`SELECT home_country FROM club_foreigners_home_override WHERE club = ?`)
    .get(normalizeClubAlias(club)) as { home_country: string } | undefined;
  return row?.home_country ?? null;
}

function yearsSpan(raw: string | null): string | null {
  if (!raw) return null;
  const nums = raw.match(/\d{4}/g);
  if (!nums || nums.length === 0) return null;
  const years = nums.map(Number);
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min}–${max}`;
}

interface ValidClub {
  club: string;
  homeCountry: string | null;
  nationalityCount: number;
  foreignerCount: number;
}

// [club, …] for every club whose senior players span >= MIN_NATIONALITIES
// distinct nationalities. The club's own country is the most-common nationality;
// foreigners are everyone else.
function findValidClubs(): ValidClub[] {
  const rows = sqlite
    .prepare(
      `SELECT cs.footballer_id, cs.club, f.nationality
       FROM career_stints cs
       JOIN footballers f ON f.id = cs.footballer_id
       WHERE cs.stint_type = 'senior' AND f.nationality IS NOT NULL AND f.nationality != ''`,
    )
    .all() as { footballer_id: number; club: string; nationality: string }[];

  // club -> (country -> distinct footballer ids)
  const clubMap = new Map<string, Map<string, Set<number>>>();
  for (const { footballer_id, club, nationality } of rows) {
    const canonical = normalizeClubAlias(club);
    if (reserveRe.test(canonical.trim())) continue;
    const country = canonicalNationality(nationality);
    if (!country) continue;
    if (!clubMap.has(canonical)) clubMap.set(canonical, new Map());
    const byCountry = clubMap.get(canonical)!;
    if (!byCountry.has(country)) byCountry.set(country, new Set());
    byCountry.get(country)!.add(footballer_id);
  }

  const overrides = homeOverrides();
  const valid: ValidClub[] = [];
  for (const [club, byCountry] of clubMap) {
    if (byCountry.size < MIN_NATIONALITIES) continue;
    let homeCountry: string | null = overrides.get(club) ?? null;
    if (!homeCountry) {
      let homeCount = -1;
      for (const [country, ids] of byCountry) {
        if (ids.size > homeCount || (ids.size === homeCount && homeCountry && country.localeCompare(homeCountry) < 0)) {
          homeCount = ids.size;
          homeCountry = country;
        }
      }
    }
    let foreignerCount = 0;
    for (const [country, ids] of byCountry) {
      if (country !== homeCountry) foreignerCount += ids.size;
    }
    valid.push({ club, homeCountry, nationalityCount: byCountry.size, foreignerCount });
  }
  return valid;
}

interface ForeignerPlayer {
  id: number;
  name: string;
  photo_url: string | null;
  nationality: string | null;
  country: string;
  position: string | null;
  apps: number;
  years: string | null;
}

// All of a club's overseas players (nationality != the club's own country) with
// their apps + years at the club, plus the excluded home country.
function clubForeigners(club: string): { homeCountry: string | null; players: ForeignerPlayer[] } {
  const variants = getClubVariants(club).map((v) => v.toLowerCase());
  const ph = variants.map(() => "?").join(", ");
  const rows = sqlite
    .prepare(
      `
    SELECT f.id, f.name, f.photo_url, f.nationality, f.position,
           SUM(COALESCE(cs.apps, 0)) as total_apps,
           GROUP_CONCAT(cs.years, '|') as years_raw
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id
      AND cs.stint_type = 'senior'
      AND LOWER(cs.club) IN (${ph})
    WHERE f.nationality IS NOT NULL AND f.nationality != ''
    GROUP BY f.id
  `,
    )
    .all(...variants) as {
    id: number;
    name: string;
    photo_url: string | null;
    nationality: string | null;
    position: string | null;
    total_apps: number;
    years_raw: string | null;
  }[];

  // Home country = manual override, else the most-common nationality.
  let homeCountry: string | null = homeOverrideFor(club);
  if (!homeCountry) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const c = canonicalNationality(r.nationality);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    let homeCount = -1;
    for (const [country, n] of counts) {
      if (n > homeCount || (n === homeCount && homeCountry && country.localeCompare(homeCountry) < 0)) {
        homeCount = n;
        homeCountry = country;
      }
    }
  }

  const players = rows
    .filter((r) => canonicalNationality(r.nationality) !== homeCountry)
    .map((r) => ({
      id: r.id,
      name: r.name,
      photo_url: r.photo_url,
      nationality: r.nationality,
      country: canonicalNationality(r.nationality),
      position: r.position,
      apps: r.total_apps,
      years: yearsSpan(r.years_raw),
    }));

  // Order by the country's foreigner count (desc) so hint slots surface the
  // most-represented foreign nations first; within a country, most apps first.
  const countryCounts = new Map<string, number>();
  for (const p of players) {
    const c = canonicalNationality(p.nationality);
    countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
  }
  players.sort((a, b) => {
    const na = canonicalNationality(a.nationality);
    const nb = canonicalNationality(b.nationality);
    const ca = countryCounts.get(na) ?? 0;
    const cb = countryCounts.get(nb) ?? 0;
    if (cb !== ca) return cb - ca;
    if (na !== nb) return na.localeCompare(nb);
    return b.apps - a.apps || a.name.localeCompare(b.name);
  });

  return { homeCountry, players };
}

// GET /api/club-foreigners/admin/clubs
clubForeignersRouter.get("/admin/clubs", (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(c.req.query("pageSize") ?? "25", 10)),
  );

  const validClubs = findValidClubs();

  // Seed all clubs as enabled on first visit (when the table is empty).
  const existingCount = (
    sqlite
      .prepare(`SELECT COUNT(*) as n FROM club_foreigners_enabled_clubs`)
      .get() as { n: number }
  ).n;
  if (existingCount === 0 && validClubs.length > 0) {
    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO club_foreigners_enabled_clubs (club) VALUES (?)`,
    );
    const insertMany = sqlite.transaction((clubs: string[]) => {
      for (const club of clubs) insert.run(club);
    });
    insertMany(validClubs.map((v) => v.club));
  }

  const enabledRows = sqlite
    .prepare(`SELECT club, round_size FROM club_foreigners_enabled_clubs`)
    .all() as { club: string; round_size: number }[];
  const enabledMap = new Map(enabledRows.map((r) => [r.club, r.round_size]));

  const sorted = validClubs.sort((a, b) => b.foreignerCount - a.foreignerCount);
  const total = sorted.length;
  const enabledCount = sorted.filter((v) => enabledMap.has(v.club)).length;
  const page_data = sorted.slice((page - 1) * pageSize, page * pageSize);

  const data = page_data.map((v) => ({
    club: v.club,
    clubWikiUrl: clubWikiUrl(v.club),
    homeCountry: v.homeCountry,
    nationalityCount: v.nationalityCount,
    foreignerCount: v.foreignerCount,
    enabled: enabledMap.has(v.club),
    roundSize: enabledMap.get(v.club) ?? 5,
  }));

  return c.json({ data, total, enabledCount, page, pageSize });
});

// GET /api/club-foreigners/admin/clubs/:club/players — accordion grouped by country
clubForeignersRouter.get("/admin/clubs/:club/players", (c) => {
  const { homeCountry, players } = clubForeigners(c.req.param("club"));
  const groups = new Map<string, ForeignerPlayer[]>();
  for (const p of players) {
    const country = canonicalNationality(p.nationality) || "Unknown";
    if (!groups.has(country)) groups.set(country, []);
    groups.get(country)!.push(p);
  }
  const data = [...groups]
    .map(([country, ps]) => ({ country, players: ps }))
    .sort((a, b) => b.players.length - a.players.length || a.country.localeCompare(b.country));
  return c.json({ homeCountry, groups: data });
});

// POST /api/club-foreigners/admin/clubs/enable
clubForeignersRouter.post(
  "/admin/clubs/enable",
  zValidator("json", z.object({ club: z.string().min(1), roundSize: z.number().int().optional() })),
  (c) => {
    const { club, roundSize } = c.req.valid("json");
    const size = roundSize && roundSize > 0 ? Math.floor(roundSize) : 5;
    sqlite
      .prepare(
        `INSERT INTO club_foreigners_enabled_clubs (club, round_size) VALUES (?, ?)
         ON CONFLICT(club) DO UPDATE SET round_size = excluded.round_size`,
      )
      .run(normalizeClubAlias(club), size);
    return c.json({ ok: true });
  },
);

// DELETE /api/club-foreigners/admin/clubs/enable
clubForeignersRouter.delete(
  "/admin/clubs/enable",
  zValidator("json", z.object({ club: z.string().min(1) })),
  (c) => {
    const { club } = c.req.valid("json");
    sqlite
      .prepare(`DELETE FROM club_foreigners_enabled_clubs WHERE LOWER(club) = LOWER(?)`)
      .run(normalizeClubAlias(club));
    return c.json({ ok: true });
  },
);

// POST /api/club-foreigners/admin/clubs/home — override the excluded home country
clubForeignersRouter.post(
  "/admin/clubs/home",
  zValidator("json", z.object({ club: z.string().min(1), homeCountry: z.string().min(1) })),
  (c) => {
    const { club, homeCountry } = c.req.valid("json");
    sqlite
      .prepare(
        `INSERT INTO club_foreigners_home_override (club, home_country) VALUES (?, ?)
         ON CONFLICT(club) DO UPDATE SET home_country = excluded.home_country`,
      )
      .run(normalizeClubAlias(club), homeCountry);
    return c.json({ ok: true });
  },
);

// DELETE /api/club-foreigners/admin/clubs/home — revert to auto-detection
clubForeignersRouter.delete(
  "/admin/clubs/home",
  zValidator("json", z.object({ club: z.string().min(1) })),
  (c) => {
    sqlite
      .prepare(`DELETE FROM club_foreigners_home_override WHERE club = ?`)
      .run(normalizeClubAlias(c.req.valid("json").club));
    return c.json({ ok: true });
  },
);

// GET /api/club-foreigners/schedule
clubForeignersRouter.get("/schedule", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT id, date, club, created_at FROM club_foreigners_schedule ORDER BY date ASC`,
    )
    .all();
  return c.json(rows);
});

// GET /api/club-foreigners/schedule/rounds
clubForeignersRouter.get("/schedule/rounds", (c) => {
  const scheduled = sqlite
    .prepare(`SELECT date, club FROM club_foreigners_schedule ORDER BY date ASC`)
    .all() as { date: string; club: string }[];
  if (scheduled.length === 0) return c.json([]);

  const countMap = new Map<string, number>();
  for (const v of findValidClubs()) countMap.set(v.club, v.foreignerCount);
  const sizeRows = sqlite
    .prepare(`SELECT club, round_size FROM club_foreigners_enabled_clubs`)
    .all() as { club: string; round_size: number }[];
  const sizeMap = new Map(sizeRows.map((r) => [r.club, r.round_size]));

  return c.json(
    scheduled.map((row) => ({
      date: row.date,
      club: row.club,
      clubWikiUrl: clubWikiUrl(row.club),
      foreignerCount: countMap.get(normalizeClubAlias(row.club)) ?? 0,
      roundSize: sizeMap.get(normalizeClubAlias(row.club)) ?? 5,
    })),
  );
});

// PUT /api/club-foreigners/schedule/:date
clubForeignersRouter.put(
  "/schedule/:date",
  zValidator("json", z.object({ club: z.string().min(1) })),
  (c) => {
    const date = c.req.param("date");
    const { club } = c.req.valid("json");
    const existing = sqlite
      .prepare(`SELECT id FROM club_foreigners_schedule WHERE date = ?`)
      .get(date);
    if (existing) {
      sqlite
        .prepare(`UPDATE club_foreigners_schedule SET club = ? WHERE date = ?`)
        .run(club, date);
    } else {
      sqlite
        .prepare(`INSERT INTO club_foreigners_schedule (date, club) VALUES (?, ?)`)
        .run(date, club);
    }
    return c.json({ ok: true });
  },
);

// DELETE /api/club-foreigners/schedule/:date
clubForeignersRouter.delete("/schedule/:date", (c) => {
  sqlite
    .prepare(`DELETE FROM club_foreigners_schedule WHERE date = ?`)
    .run(c.req.param("date"));
  return c.json({ ok: true });
});

// DELETE /api/club-foreigners/schedule
clubForeignersRouter.delete("/schedule", (c) => {
  sqlite.prepare(`DELETE FROM club_foreigners_schedule`).run();
  return c.json({ ok: true });
});

// GET /api/club-foreigners/answers?club=Y — the flat overseas-player pool.
clubForeignersRouter.get("/answers", (c) => {
  const club = c.req.query("club") ?? "";
  if (!club) return c.json({ error: "club required" }, 400);
  return c.json(clubForeigners(club).players);
});

// POST /api/club-foreigners/verify — a guess is valid when the footballer made a
// senior stint at the club AND their nationality isn't the club's own country.
// Unknown players are scraped from Wikipedia and imported if they qualify.
clubForeignersRouter.post(
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
    const { homeCountry } = clubForeigners(club);

    const inPool = (id: number) => clubForeigners(club).players.find((p) => p.id === id);
    const isForeign = (nat: string | null | undefined) => {
      const cn = canonicalNationality(nat ?? "");
      return !!cn && cn !== homeCountry;
    };
    const seniorClubsOf = (id: number) =>
      (
        sqlite
          .prepare(`SELECT club FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior'`)
          .all(id) as { club: string }[]
      ).map((r) => r.club);

    async function importSeniorStints(id: number, scraped: Awaited<ReturnType<typeof scrapeWikipedia>>) {
      for (const s of scraped.stints.filter((x) => x.stint_type === "senior")) {
        const exists = sqlite
          .prepare(`SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = 'senior' LIMIT 1`)
          .get(id, s.years, s.club);
        if (!exists) {
          const maxOrder = sqlite
            .prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`)
            .get(id) as { next: number };
          await db.insert(career_stints).values({
            footballer_id: id, sort_order: maxOrder.next, years: s.years, club: s.club,
            club_wikipedia_url: s.club_wikipedia_url ?? null, apps: s.apps ?? null, goals: s.goals ?? null, stint_type: "senior",
          });
        }
      }
    }

    const success = (id: number, imported: boolean) => {
      const p = inPool(id);
      if (p) return c.json({ valid: true, footballer: p, imported });
      const row = sqlite.prepare(`SELECT name, photo_url, nationality, position FROM footballers WHERE id = ?`).get(id) as
        | { name: string; photo_url: string | null; nationality: string | null; position: string | null }
        | undefined;
      return c.json({
        valid: true,
        footballer: { id, name: row?.name ?? footballerName, photo_url: row?.photo_url ?? null, nationality: row?.nationality ?? null, country: canonicalNationality(row?.nationality ?? ""), position: row?.position ?? null, apps: 0, years: null },
        imported,
      });
    };

    // Step 1: resolve from DB (by id, then name)
    let footballer:
      | { id: number; name: string; wikipedia_url: string; photo_url: string | null; nationality: string | null }
      | undefined;
    if (footballerId != null) {
      footballer = await db
        .select({ id: footballers.id, name: footballers.name, wikipedia_url: footballers.wikipedia_url, photo_url: footballers.photo_url, nationality: footballers.nationality })
        .from(footballers).where(eq(footballers.id, footballerId)).limit(1).then((r) => r[0]);
    }
    if (!footballer) {
      footballer = await db
        .select({ id: footballers.id, name: footballers.name, wikipedia_url: footballers.wikipedia_url, photo_url: footballers.photo_url, nationality: footballers.nationality })
        .from(footballers)
        .where(sql`LOWER(normalize(${footballers.name})) = LOWER(normalize(${footballerName}))`)
        .limit(1).then((r) => r[0]);
    }

    if (footballer) {
      if (inPool(footballer.id)) return success(footballer.id, false);
      // Stints may be stale (missing the club) — rescrape and re-check.
      if (footballer.wikipedia_url) {
        try {
          const scraped = await scrapeWikipedia(footballer.wikipedia_url);
          await importSeniorStints(footballer.id, scraped);
          if (footballer.nationality == null && scraped.nationality) {
            sqlite.prepare(`UPDATE footballers SET nationality = ? WHERE id = ?`).run(scraped.nationality, footballer.id);
          }
          if (inPool(footballer.id)) return success(footballer.id, true);
        } catch { /* fall through */ }
      }
      const clubs = seniorClubsOf(footballer.id);
      const reason = hasClub(clubs, club) ? "home_nation" : "wrong_club";
      return c.json({ valid: false, foundName: footballer.name, imported: false, reason });
    }

    // Step 2: not in DB — Wikipedia name search → import
    try {
      const wikiHeaders = { "User-Agent": "GuessTheCareer-Admin/1.0" };
      const strip = normalizeName;
      const nameParts = strip(footballerName).split(/\s+/).filter((p) => p.length > 2);
      const titleMatches = (title: string) => nameParts.length > 0 && nameParts.every((p) => strip(title).includes(p));
      async function wikiSearch(query: string): Promise<string[]> {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
        const res = await fetch(url, { headers: wikiHeaders });
        if (!res.ok) return [];
        const data = (await res.json()) as { query?: { search?: { title: string }[] } };
        return (data.query?.search ?? []).map((s) => s.title);
      }

      const titles: string[] = [];
      for (const q of [`${footballerName} footballer`, `${footballerName} ${club}`, footballerName]) {
        for (const title of await wikiSearch(q)) if (titleMatches(title) && !titles.includes(title)) titles.push(title);
      }
      if (titles.length === 0) return c.json({ valid: false, footballer: null, imported: false });

      let fallback: { valid: false; foundName: string; imported: false; reason: string } | null = null;
      for (const title of titles.slice(0, 6)) {
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
        const byUrl = await db
          .select({ id: footballers.id })
          .from(footballers).where(eq(footballers.wikipedia_url, wikiUrl)).limit(1).then((r) => r[0]);
        if (byUrl && inPool(byUrl.id)) return success(byUrl.id, false);

        await new Promise((r) => setTimeout(r, 300));
        let scraped;
        try { scraped = await scrapeWikipedia(wikiUrl); } catch { continue; }
        const seniors = scraped.stints.filter((s) => s.stint_type === "senior");
        if (!hasClub(seniors.map((s) => s.club), club)) {
          fallback ??= { valid: false, foundName: scraped.name, imported: false, reason: "wrong_club" };
          continue;
        }
        if (!isForeign(scraped.nationality)) {
          fallback ??= { valid: false, foundName: scraped.name, imported: false, reason: "home_nation" };
          continue;
        }
        if (!isRetired(scraped.stints)) {
          return c.json({ valid: false, foundName: scraped.name, imported: false, reason: "not_retired" });
        }

        if (byUrl) {
          sqlite.prepare(`UPDATE footballers SET photo_url = COALESCE(photo_url, ?), nationality = COALESCE(nationality, ?) WHERE id = ?`)
            .run(scraped.photo_url ?? null, scraped.nationality ?? null, byUrl.id);
          await importSeniorStints(byUrl.id, scraped);
          return success(byUrl.id, true);
        }
        const [created] = await db.insert(footballers).values({
          name: scraped.name, wikipedia_url: scraped.wikipedia_url, nationality: scraped.nationality,
          position: scraped.position, all_positions: scraped.all_positions ?? null, born: scraped.born, photo_url: scraped.photo_url ?? null,
        }).returning();
        await importSeniorStints(created.id, scraped);
        return success(created.id, true);
      }
      return c.json(fallback ?? { valid: false, footballer: null, imported: false });
    } catch {
      return c.json({ valid: false, footballer: null, imported: false });
    }
  },
);
