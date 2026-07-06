import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, sqlite } from "../db/client.ts";
import { footballers } from "../db/schema.ts";
import { normalizeClubAlias } from "../services/scraper.ts";
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

  const valid: ValidClub[] = [];
  for (const [club, byCountry] of clubMap) {
    if (byCountry.size < MIN_NATIONALITIES) continue;
    let homeCountry: string | null = null;
    let homeCount = -1;
    for (const [country, ids] of byCountry) {
      if (ids.size > homeCount || (ids.size === homeCount && homeCountry && country.localeCompare(homeCountry) < 0)) {
        homeCount = ids.size;
        homeCountry = country;
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

  // Home country = the most-common nationality among the club's players.
  const counts = new Map<string, number>();
  for (const r of rows) {
    const c = canonicalNationality(r.nationality);
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let homeCountry: string | null = null;
  let homeCount = -1;
  for (const [country, n] of counts) {
    if (n > homeCount || (n === homeCount && homeCountry && country.localeCompare(homeCountry) < 0)) {
      homeCount = n;
      homeCountry = country;
    }
  }

  const players = rows
    .filter((r) => canonicalNationality(r.nationality) !== homeCountry)
    .map((r) => ({
      id: r.id,
      name: r.name,
      photo_url: r.photo_url,
      nationality: r.nationality,
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

// POST /api/club-foreigners/verify — DB-only: a guess is valid when the footballer
// made a senior stint at the club AND their nationality isn't the club's country.
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

    const { players } = clubForeigners(club);
    const byId = new Map(players.map((p) => [p.id, p]));

    let footballer: { id: number; name: string } | undefined;
    if (footballerId != null) {
      footballer = await db
        .select({ id: footballers.id, name: footballers.name })
        .from(footballers)
        .where(eq(footballers.id, footballerId))
        .limit(1)
        .then((r) => r[0]);
    }
    if (!footballer) {
      footballer = await db
        .select({ id: footballers.id, name: footballers.name })
        .from(footballers)
        .where(
          sql`LOWER(normalize(${footballers.name})) = LOWER(normalize(${footballerName}))`,
        )
        .limit(1)
        .then((r) => r[0]);
    }

    if (footballer) {
      const hit = byId.get(footballer.id);
      if (hit) return c.json({ valid: true, footballer: hit, imported: false });
      // Played for the club but is a home-nation player, or never played there.
      const stintClubs = (
        sqlite
          .prepare(
            `SELECT club FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior'`,
          )
          .all(footballer.id) as { club: string }[]
      ).map((r) => r.club);
      const reason = hasClub(stintClubs, club) ? "home_nation" : "wrong_club";
      return c.json({ valid: false, foundName: footballer.name, imported: false, reason });
    }

    return c.json({ valid: false, footballer: null, imported: false });
  },
);
