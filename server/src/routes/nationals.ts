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

export const nationalsRouter = new Hono();

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

const reserveRe =
  /\s(B|C|II|III|IV|reserves?|under[- ]?\d+|u\d+|youth|academy)$/i;

// Nationality ISO map for equivalence checks (demonym + noun forms)
const NATIONALITY_ISO: Record<string, string> = {
  English: "GB-ENG",
  England: "GB-ENG",
  Scottish: "GB-SCT",
  Scotland: "GB-SCT",
  Welsh: "GB-WLS",
  Wales: "GB-WLS",
  "Northern Irish": "GB-NIR",
  "Northern Ireland": "GB-NIR",
  Dutch: "NL",
  Netherlands: "NL",
  German: "DE",
  Germany: "DE",
  "West Germany": "DE",
  "East Germany": "DE",
  French: "FR",
  France: "FR",
  Spanish: "ES",
  Spain: "ES",
  Italian: "IT",
  Italy: "IT",
  Portuguese: "PT",
  Portugal: "PT",
  Brazilian: "BR",
  Brazil: "BR",
  Argentine: "AR",
  Argentinian: "AR",
  Argentina: "AR",
  Belgian: "BE",
  Belgium: "BE",
  Croatian: "HR",
  Croatia: "HR",
  Uruguayan: "UY",
  Uruguay: "UY",
  Colombian: "CO",
  Colombia: "CO",
  Chilean: "CL",
  Chile: "CL",
  Mexican: "MX",
  Mexico: "MX",
  American: "US",
  "United States": "US",
  Turkish: "TR",
  Turkey: "TR",
  Russian: "RU",
  Russia: "RU",
  Ukrainian: "UA",
  Ukraine: "UA",
  Polish: "PL",
  Poland: "PL",
  Czech: "CZ",
  "Czech Republic": "CZ",
  Slovak: "SK",
  Slovakia: "SK",
  Austrian: "AT",
  Austria: "AT",
  Swiss: "CH",
  Switzerland: "CH",
  Swedish: "SE",
  Sweden: "SE",
  Norwegian: "NO",
  Norway: "NO",
  Danish: "DK",
  Denmark: "DK",
  Finnish: "FI",
  Finland: "FI",
  Icelandic: "IS",
  Iceland: "IS",
  Serbian: "RS",
  Serbia: "RS",
  "Serbia and Montenegro": "RS",
  Greek: "GR",
  Greece: "GR",
  Romanian: "RO",
  Romania: "RO",
  Hungarian: "HU",
  Hungary: "HU",
  Slovenian: "SI",
  Slovenia: "SI",
  Macedonian: "MK",
  "North Macedonia": "MK",
  Albanian: "AL",
  Albania: "AL",
  Bosnian: "BA",
  "Bosnia and Herzegovina": "BA",
  Montenegrin: "ME",
  Montenegro: "ME",
  Bulgarian: "BG",
  Bulgaria: "BG",
  Georgian: "GE",
  Georgia: "GE",
  Armenian: "AM",
  Armenia: "AM",
  Belarusian: "BY",
  Belarus: "BY",
  Azerbaijani: "AZ",
  Azerbaijan: "AZ",
  Israeli: "IL",
  Israel: "IL",
  Irish: "IE",
  "Republic of Ireland": "IE",
  Ireland: "IE",
  Ecuadorian: "EC",
  Ecuador: "EC",
  Paraguayan: "PY",
  Paraguay: "PY",
  Bolivian: "BO",
  Bolivia: "BO",
  Peruvian: "PE",
  Peru: "PE",
  Venezuelan: "VE",
  Venezuela: "VE",
  Japanese: "JP",
  Japan: "JP",
  "South Korean": "KR",
  "South Korea": "KR",
  Australian: "AU",
  Australia: "AU",
  Moroccan: "MA",
  Morocco: "MA",
  Algerian: "DZ",
  Algeria: "DZ",
  Nigerian: "NG",
  Nigeria: "NG",
  Senegalese: "SN",
  Senegal: "SN",
  Ghanaian: "GH",
  Ghana: "GH",
  Ivorian: "CI",
  "Ivory Coast": "CI",
  Cameroonian: "CM",
  Cameroon: "CM",
  Egyptian: "EG",
  Egypt: "EG",
  Tunisian: "TN",
  Tunisia: "TN",
  Liberian: "LR",
  Liberia: "LR",
  Guinean: "GN",
  Guinea: "GN",
  Congolese: "CD",
  "DR Congo": "CD",
  Malian: "ML",
  Mali: "ML",
  "Saudi Arabian": "SA",
  "Saudi Arabia": "SA",
  Qatari: "QA",
  Qatar: "QA",
};

function allNationalityIsos(nat: string | null | undefined): Set<string> {
  if (!nat) return new Set();
  const trimmed = nat.trim();
  const direct = NATIONALITY_ISO[trimmed];
  if (direct) return new Set([direct]);
  // Handle multi-value strings like "Italy Australia"
  const isos = new Set<string>();
  for (const part of trimmed.split(/\s+/)) {
    const partIso = NATIONALITY_ISO[part];
    if (partIso) isos.add(partIso);
  }
  return isos;
}

function nationalitiesMatch(
  playerNat: string | null | undefined,
  targetNat: string,
): boolean {
  if (!playerNat) return false;
  if (playerNat.toLowerCase().trim() === targetNat.toLowerCase().trim())
    return true;
  const targetIso = NATIONALITY_ISO[targetNat.trim()];
  if (!targetIso) return false;
  const playerIsos = allNationalityIsos(playerNat);
  return playerIsos.has(targetIso);
}

interface NatStintRow {
  nationality: string | null;
  footballer_id: number;
  club: string;
}

function findValidCombos(): [string, string, number][] {
  const rows = sqlite
    .prepare(
      `
    SELECT f.nationality, cs.footballer_id, cs.club
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id
    WHERE cs.stint_type = 'senior' AND f.nationality IS NOT NULL AND f.nationality != ''
  `,
    )
    .all() as NatStintRow[];

  const natMap = new Map<string, Map<string, Set<number>>>();
  for (const { nationality, footballer_id, club } of rows) {
    if (!nationality) continue;
    const nat = nationality.trim();
    const canonical = normalizeClubAlias(club);
    if (reserveRe.test(canonical.trim())) continue;

    if (!natMap.has(nat)) natMap.set(nat, new Map());
    const clubMap = natMap.get(nat)!;
    if (!clubMap.has(canonical)) clubMap.set(canonical, new Set());
    clubMap.get(canonical)!.add(footballer_id);
  }

  const validCombos: [string, string, number][] = [];
  for (const [nationality, clubMap] of natMap) {
    for (const [club, playerSet] of clubMap) {
      if (playerSet.size >= 5) {
        validCombos.push([nationality, club, playerSet.size]);
      }
    }
  }
  return validCombos;
}

// GET /api/nationals/admin/combos
nationalsRouter.get("/admin/combos", (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(c.req.query("pageSize") ?? "25", 10)),
  );

  const validCombos = findValidCombos();

  const existingCount = (
    sqlite
      .prepare(`SELECT COUNT(*) as n FROM nationals_enabled_combos`)
      .get() as { n: number }
  ).n;
  if (existingCount === 0 && validCombos.length > 0) {
    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO nationals_enabled_combos (nationality, club) VALUES (?, ?)`,
    );
    const insertMany = sqlite.transaction((combos: [string, string][]) => {
      for (const [nat, club] of combos) insert.run(nat, club);
    });
    insertMany(validCombos.map(([nat, club]) => [nat, club]));
  }

  const enabledRows = sqlite
    .prepare(`SELECT nationality, club FROM nationals_enabled_combos`)
    .all() as { nationality: string; club: string }[];
  const enabledSet = new Set(
    enabledRows.map((r) => `${r.nationality}|||${r.club}`),
  );

  const sorted = validCombos.sort((a, b) => b[2] - a[2]);
  const total = sorted.length;
  const enabledCount = sorted.filter(([nat, club]) =>
    enabledSet.has(`${nat}|||${club}`),
  ).length;
  const page_data = sorted.slice((page - 1) * pageSize, page * pageSize);

  const data = page_data.map(([nationality, club, playerCount]) => {
    const clubRow = sqlite
      .prepare(
        `SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      )
      .get(club) as { wikipedia_url: string | null } | undefined;
    return {
      nationality,
      club,
      clubWikiUrl: clubRow?.wikipedia_url ?? null,
      playerCount,
      enabled: enabledSet.has(`${nationality}|||${club}`),
    };
  });

  return c.json({ data, total, enabledCount, page, pageSize });
});

// POST /api/nationals/admin/combos/enable
nationalsRouter.post(
  "/admin/combos/enable",
  zValidator(
    "json",
    z.object({ nationality: z.string().min(1), club: z.string().min(1) }),
  ),
  (c) => {
    const { nationality, club } = c.req.valid("json");
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO nationals_enabled_combos (nationality, club) VALUES (?, ?)`,
      )
      .run(nationality, normalizeClubAlias(club));
    return c.json({ ok: true });
  },
);

// DELETE /api/nationals/admin/combos/enable
nationalsRouter.delete(
  "/admin/combos/enable",
  zValidator(
    "json",
    z.object({ nationality: z.string().min(1), club: z.string().min(1) }),
  ),
  (c) => {
    const { nationality, club } = c.req.valid("json");
    sqlite
      .prepare(
        `DELETE FROM nationals_enabled_combos WHERE LOWER(nationality) = LOWER(?) AND LOWER(club) = LOWER(?)`,
      )
      .run(nationality, normalizeClubAlias(club));
    return c.json({ ok: true });
  },
);

// GET /api/nationals/schedule — admin list
nationalsRouter.get("/schedule", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT id, date, nationality, club, created_at FROM nationals_schedule ORDER BY date ASC`,
    )
    .all() as {
    id: number;
    date: string;
    nationality: string;
    club: string;
    created_at: string;
  }[];
  return c.json(rows);
});

// GET /api/nationals/schedule/rounds — game data with wiki URLs
nationalsRouter.get("/schedule/rounds", (c) => {
  const scheduled = sqlite
    .prepare(
      `SELECT date, nationality, club FROM nationals_schedule ORDER BY date ASC`,
    )
    .all() as { date: string; nationality: string; club: string }[];

  if (scheduled.length === 0) return c.json([]);

  const validCombos = findValidCombos();
  const countMap = new Map<string, number>();
  for (const [nat, club, count] of validCombos) {
    countMap.set(`${nat}|||${club}`, count);
  }

  const rounds = scheduled.map((row) => {
    const clubRow = sqlite
      .prepare(
        `SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      )
      .get(row.club) as { wikipedia_url: string | null } | undefined;
    return {
      date: row.date,
      nationality: row.nationality,
      club: row.club,
      clubWikiUrl: clubRow?.wikipedia_url ?? null,
      playerCount: countMap.get(`${row.nationality}|||${row.club}`) ?? 0,
    };
  });

  return c.json(rounds);
});

// PUT /api/nationals/schedule/:date
nationalsRouter.put(
  "/schedule/:date",
  zValidator(
    "json",
    z.object({ nationality: z.string().min(1), club: z.string().min(1) }),
  ),
  (c) => {
    const date = c.req.param("date");
    const { nationality, club } = c.req.valid("json");
    const existing = sqlite
      .prepare(`SELECT id FROM nationals_schedule WHERE date = ?`)
      .get(date);
    if (existing) {
      sqlite
        .prepare(
          `UPDATE nationals_schedule SET nationality = ?, club = ? WHERE date = ?`,
        )
        .run(nationality, club, date);
    } else {
      sqlite
        .prepare(
          `INSERT INTO nationals_schedule (date, nationality, club) VALUES (?, ?, ?)`,
        )
        .run(date, nationality, club);
    }
    return c.json({ ok: true });
  },
);

// DELETE /api/nationals/schedule/:date
nationalsRouter.delete("/schedule/:date", (c) => {
  const date = c.req.param("date");
  sqlite.prepare(`DELETE FROM nationals_schedule WHERE date = ?`).run(date);
  return c.json({ ok: true });
});

// DELETE /api/nationals/schedule
nationalsRouter.delete("/schedule", (c) => {
  sqlite.prepare(`DELETE FROM nationals_schedule`).run();
  return c.json({ ok: true });
});

// GET /api/nationals/answers?nationality=X&club=Y
nationalsRouter.get("/answers", (c) => {
  const nationality = c.req.query("nationality") ?? "";
  const club = c.req.query("club") ?? "";
  if (!nationality || !club)
    return c.json({ error: "nationality and club required" }, 400);

  const variants = getClubVariants(club).map((v) => v.toLowerCase());
  const ph = variants.map(() => "?").join(", ");

  const rows = sqlite
    .prepare(
      `
    SELECT DISTINCT f.id, f.name, f.photo_url
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id
      AND cs.stint_type = 'senior'
      AND LOWER(cs.club) IN (${ph})
    WHERE LOWER(f.nationality) = LOWER(?)
    ORDER BY f.name ASC
  `,
    )
    .all(...variants, nationality) as {
    id: number;
    name: string;
    photo_url: string | null;
  }[];

  return c.json(rows);
});

// POST /api/nationals/verify
nationalsRouter.post(
  "/verify",
  zValidator(
    "json",
    z.object({
      footballerName: z.string().min(1),
      footballerId: z.number().int().nullish(),
      nationality: z.string().min(1),
      club: z.string().min(1),
    }),
  ),
  async (c) => {
    const { footballerName, footballerId, nationality, club } =
      c.req.valid("json");

    function checkQualifies(
      stintClubs: string[],
      nat: string | null | undefined,
    ): boolean {
      return nationalitiesMatch(nat, nationality) && hasClub(stintClubs, club);
    }

    type FailReason = "wrong_nationality" | "wrong_club" | "wrong_both";
    function failReason(
      stintClubs: string[],
      nat: string | null | undefined,
    ): FailReason {
      const natOk = nationalitiesMatch(nat, nationality);
      const clubOk = hasClub(stintClubs, club);
      if (!natOk && !clubOk) return "wrong_both";
      if (!natOk) return "wrong_nationality";
      return "wrong_club";
    }
    function invalidJson(
      name: string,
      nat: string | null | undefined,
      stintClubs: string[],
    ) {
      const reason = failReason(stintClubs, nat);
      return {
        valid: false,
        foundName: name,
        foundNationality: reason === "wrong_nationality" ? (nat ?? null) : null,
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
          nationality: string | null;
        }
      | undefined;

    if (footballerId != null) {
      footballer = await db
        .select({
          id: footballers.id,
          name: footballers.name,
          wikipedia_url: footballers.wikipedia_url,
          photo_url: footballers.photo_url,
          nationality: footballers.nationality,
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
          nationality: footballers.nationality,
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
            nationality: footballers.nationality,
          })
          .from(footballers)
          .where(sql`normalize(${footballers.name}) = ${normalizedName}`)
          .limit(1)
          .then((r) => r[0]);
      }
    }

    // Step 2: if found, check stints + nationality
    if (footballer) {
      const stints = await db
        .select({ club: career_stints.club })
        .from(career_stints)
        .where(
          sql`${career_stints.footballer_id} = ${footballer.id} AND ${career_stints.stint_type} = 'senior'`,
        );
      const stintClubs = stints.map((s) => s.club);

      if (checkQualifies(stintClubs, footballer.nationality)) {
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
          const scraperNat = scraped.nationality ?? footballer.nationality;
          const refreshed = await db
            .select({ club: career_stints.club })
            .from(career_stints)
            .where(
              sql`${career_stints.footballer_id} = ${footballer.id} AND ${career_stints.stint_type} = 'senior'`,
            );
          const refreshedClubs = refreshed.map((s) => s.club);
          if (checkQualifies(refreshedClubs, scraperNat)) {
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

      // Gather candidate titles across queries. A name like "Javier Garrido"
      // matches several Wikipedia people, so we can't trust the first hit —
      // collect every name-matching candidate and later keep the one that
      // actually qualifies for this nationality + club.
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
        return c.json({ valid: false, footballer: null, imported: false });

      // Remember the first concrete "wrong" result so we can return a
      // meaningful reason if no candidate ends up qualifying.
      let fallbackInvalid: ReturnType<typeof invalidJson> | null = null;

      for (const title of candidateTitles.slice(0, 6)) {
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

        const byUrl = await db
          .select({
            id: footballers.id,
            name: footballers.name,
            photo_url: footballers.photo_url,
            nationality: footballers.nationality,
          })
          .from(footballers)
          .where(eq(footballers.wikipedia_url, wikiUrl))
          .limit(1)
          .then((r) => r[0]);

        if (byUrl) {
          const stints = await db
            .select({ club: career_stints.club })
            .from(career_stints)
            .where(
              sql`${career_stints.footballer_id} = ${byUrl.id} AND ${career_stints.stint_type} = 'senior'`,
            );
          const stintClubs = stints.map((s) => s.club);
          if (checkQualifies(stintClubs, byUrl.nationality)) {
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
          // Disambiguation page / no infobox — try the next candidate.
          continue;
        }
        const seniorStints = scraped.stints.filter(
          (s) => s.stint_type === "senior",
        );
        const stintClubs = seniorStints.map((s) => s.club);

        if (!checkQualifies(stintClubs, scraped.nationality)) {
          // Wrong person for this combo — remember why, keep looking.
          fallbackInvalid ??= invalidJson(
            scraped.name,
            scraped.nationality,
            stintClubs,
          );
          continue;
        }
        if (!isRetired(scraped.stints)) {
          return c.json({
            valid: false,
            foundName: scraped.name,
            foundNationality: null,
            imported: false,
            reason: "not_retired" as const,
          });
        }

        const knownRecord = byUrl ?? footballer;
        if (knownRecord) {
          sqlite
            .prepare(
              `UPDATE footballers SET wikipedia_url = ?, photo_url = COALESCE(photo_url, ?), nationality = COALESCE(nationality, ?) WHERE id = ?`,
            )
            .run(
              wikiUrl,
              scraped.photo_url ?? null,
              scraped.nationality ?? null,
              knownRecord.id,
            );
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

      // No candidate qualified — surface the first concrete mismatch if any.
      return c.json(
        fallbackInvalid ?? { valid: false, footballer: null, imported: false },
      );
    } catch {
      return c.json({ valid: false, footballer: null, imported: false });
    }
  },
);
