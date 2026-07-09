import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, sqlite } from "../db/client.ts";
import { footballers, career_stints } from "../db/schema.ts";
import { scrapeWikipedia } from "../services/scraper.ts";

export const positionKnowledgeRouter = new Hono();

const NATION_NATIONALITIES: Record<string, string[]> = {
  England: ["English", "England"],
  Spain: ["Spanish", "Spain"],
  Italy: ["Italian", "Italy"],
  France: ["French", "France"],
  Germany: ["German", "Germany"],
  Argentina: ["Argentine", "Argentinian", "Argentina"],
  Brazil: ["Brazilian", "Brazil"],
  Netherlands: ["Dutch", "Netherlands", "Holland"],
  Portugal: ["Portuguese", "Portugal"],
  Ireland: ["Irish", "Ireland", "Republic of Ireland"],
};

const POSITION_PATTERNS: Record<string, string[]> = {
  goalkeeper: ["%goalkeeper%", "%goaltender%"],
  right_back: [
    "%right back%",
    "%right-back%",
    "%right wing back%",
    "%right wingback%",
    "%full-back%",
    "%full back%",
    "%fullback%",
  ],
  left_back: [
    "%left back%",
    "%left-back%",
    "%left wing back%",
    "%left wingback%",
    "%full-back%",
    "%full back%",
    "%fullback%",
  ],
  centre_back: [
    "%centre back%",
    "%center back%",
    "%centre-back%",
    "%center-back%",
    "%central defender%",
    "%sweeper%",
  ],
  midfielder: ["%midfielder%"],
  central_midfielder: ["%central midfielder%", "%centre midfielder%", "%center midfielder%", "%box-to-box%", "%box to box%"],
  defensive_midfielder: ["%defensive midfielder%", "%holding midfielder%"],
  attacking_midfielder: ["%attacking midfielder%", "%trequartista%"],
  winger: ["%winger%", "%wide midfielder%", "%wide forward%"],
  striker: ["%striker%", "%forward%", "%centre forward%", "%center forward%"],
};

const FULL_BACK_STRINGS = ["full-back", "full back", "fullback"];
const VALID_NATIONS = new Set(Object.keys(NATION_NATIONALITIES));
const VALID_POSITIONS = new Set(Object.keys(POSITION_PATTERNS));

function matchesPosition(
  dbPosition: string | null,
  allPositions: string | null,
  customPosition: string | null,
  positionKey: string,
): boolean {
  const patterns = POSITION_PATTERNS[positionKey] ?? [];
  const check = (val: string | null) => {
    if (!val) return false;
    const lower = val.toLowerCase();
    return patterns.some((p) => lower.includes(p.replace(/%/g, "")));
  };
  const isFullBack = (val: string | null) => {
    if (!val) return false;
    const lower = val.toLowerCase();
    return FULL_BACK_STRINGS.some((f) => lower.includes(f));
  };
  if (
    ["right_back", "left_back"].includes(positionKey) &&
    (isFullBack(dbPosition) || isFullBack(allPositions) || isFullBack(customPosition))
  ) {
    return true;
  }
  return check(dbPosition) || check(allPositions) || check(customPosition);
}

function matchesNation(dbNationality: string | null, nation: string): boolean {
  if (!dbNationality) return false;
  const variants = NATION_NATIONALITIES[nation] ?? [];
  return variants.some((v) => v.toLowerCase() === dbNationality.toLowerCase());
}

// GET /api/position-knowledge/players?nation=England&position=goalkeeper
positionKnowledgeRouter.get("/players", async (c) => {
  const nation = c.req.query("nation") ?? "";
  const position = c.req.query("position") ?? "";

  if (!VALID_NATIONS.has(nation))
    return c.json({ error: "Invalid nation" }, 400);
  if (!VALID_POSITIONS.has(position))
    return c.json({ error: "Invalid position" }, 400);

  const natLower = NATION_NATIONALITIES[nation].map((n) => n.toLowerCase());
  const posPatterns = POSITION_PATTERNS[position].map((p) => p.toLowerCase());

  const natPlaceholders = natLower.map(() => "?").join(", ");
  const posConditions = posPatterns
    .map(() => `LOWER(position) LIKE ? OR LOWER(all_positions) LIKE ? OR LOWER(custom_position) LIKE ?`)
    .join(" OR ");

  const posParams = posPatterns.flatMap((p) => [p, p, p]);

  const rows = sqlite
    .prepare(
      `
    SELECT id, name, photo_url
    FROM footballers
    WHERE LOWER(nationality) IN (${natPlaceholders})
      AND (position IS NOT NULL OR all_positions IS NOT NULL OR custom_position IS NOT NULL)
      AND (${posConditions})
    ORDER BY name ASC
  `,
    )
    .all(...natLower, ...posParams) as {
    id: number;
    name: string;
    photo_url: string | null;
  }[];

  return c.json(rows);
});

// POST /api/position-knowledge/verify
positionKnowledgeRouter.post(
  "/verify",
  zValidator(
    "json",
    z.object({
      playerName: z.string().min(1),
      playerId: z.number().int().optional(),
      nation: z.string().min(1),
      position: z.string().min(1),
    }),
  ),
  async (c) => {
    const { playerName, playerId, nation, position } = c.req.valid("json");

    if (!VALID_NATIONS.has(nation) || !VALID_POSITIONS.has(position)) {
      return c.json({ valid: false, footballer: null, imported: false });
    }

    type FootballerRow = {
      id: number;
      name: string;
      nationality: string | null;
      position: string | null;
      all_positions: string | null;
      custom_position: string | null;
      wikipedia_url: string;
      photo_url: string | null;
    };

    // Step 1: resolve from DB
    let footballer: FootballerRow | undefined;

    if (playerId != null) {
      footballer = await db
        .select({
          id: footballers.id,
          name: footballers.name,
          nationality: footballers.nationality,
          position: footballers.position,
          all_positions: footballers.all_positions,
          custom_position: footballers.custom_position,
          wikipedia_url: footballers.wikipedia_url,
          photo_url: footballers.photo_url,
        })
        .from(footballers)
        .where(eq(footballers.id, playerId))
        .limit(1)
        .then((r) => r[0]);
    }

    if (!footballer) {
      const normalizedName = playerName
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      footballer = await db
        .select({
          id: footballers.id,
          name: footballers.name,
          nationality: footballers.nationality,
          position: footballers.position,
          all_positions: footballers.all_positions,
          custom_position: footballers.custom_position,
          wikipedia_url: footballers.wikipedia_url,
          photo_url: footballers.photo_url,
        })
        .from(footballers)
        .where(
          sql`LOWER(normalize(${footballers.name})) = LOWER(normalize(${playerName}))`,
        )
        .limit(1)
        .then((r) => r[0]);

      if (!footballer) {
        footballer = await db
          .select({
            id: footballers.id,
            name: footballers.name,
            nationality: footballers.nationality,
            position: footballers.position,
            all_positions: footballers.all_positions,
            custom_position: footballers.custom_position,
            wikipedia_url: footballers.wikipedia_url,
            photo_url: footballers.photo_url,
          })
          .from(footballers)
          .where(sql`normalize(${footballers.name}) = ${normalizedName}`)
          .limit(1)
          .then((r) => r[0]);
      }
    }

    // Step 2: found in DB — check nationality + position
    if (footballer) {
      if (
        matchesNation(footballer.nationality, nation) &&
        matchesPosition(footballer.position, footballer.all_positions, footballer.custom_position, position)
      ) {
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

      // Position missing or mismatched — try a rescrape to refresh
      if (
        footballer.wikipedia_url &&
        !matchesPosition(
          footballer.position,
          footballer.all_positions,
          footballer.custom_position,
          position,
        )
      ) {
        try {
          const scraped = await scrapeWikipedia(footballer.wikipedia_url);
          await db
            .update(footballers)
            .set({
              position: scraped.position,
              all_positions: scraped.all_positions ?? null,
              style_of_play: scraped.style_of_play ?? null,
              nationality: scraped.nationality ?? footballer.nationality,
              updated_at: sql`(datetime('now'))`,
            })
            .where(eq(footballers.id, footballer.id));
          const n = scraped.nationality ?? footballer.nationality;
          if (
            matchesNation(n, nation) &&
            matchesPosition(scraped.position, scraped.all_positions, scraped.style_of_play ?? null, position)
          ) {
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
          /* ignore */
        }
      }

      return c.json({ valid: false, footballer: null, imported: false });
    }

    // Step 3: not in DB — search Wikipedia, scrape, validate, insert if valid
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + " footballer")}&format=json&srlimit=1`;
      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "GuessTheCareer-Admin/1.0" },
      });
      if (!searchRes.ok) throw new Error("Wikipedia search failed");
      const searchData = (await searchRes.json()) as {
        query?: { search?: { title: string }[] };
      };
      const firstResult = searchData.query?.search?.[0];
      if (!firstResult)
        return c.json({ valid: false, footballer: null, imported: false });

      const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(firstResult.title.replace(/ /g, "_"))}`;

      // Already in DB by URL?
      const byUrl = await db
        .select({
          id: footballers.id,
          name: footballers.name,
          nationality: footballers.nationality,
          position: footballers.position,
          all_positions: footballers.all_positions,
          custom_position: footballers.custom_position,
          photo_url: footballers.photo_url,
        })
        .from(footballers)
        .where(eq(footballers.wikipedia_url, wikiUrl))
        .limit(1)
        .then((r) => r[0]);

      if (byUrl) {
        if (
          matchesNation(byUrl.nationality, nation) &&
          matchesPosition(byUrl.position, byUrl.all_positions, byUrl.custom_position, position)
        ) {
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
        return c.json({ valid: false, footballer: null, imported: false });
      }

      await new Promise((r) => setTimeout(r, 300));
      const scraped = await scrapeWikipedia(wikiUrl);

      if (
        !matchesNation(scraped.nationality, nation) ||
        !matchesPosition(scraped.position, scraped.all_positions, scraped.style_of_play ?? null, position)
      ) {
        return c.json({ valid: false, footballer: null, imported: false });
      }

      const [newFootballer] = await db
        .insert(footballers)
        .values({
          name: scraped.name,
          wikipedia_url: scraped.wikipedia_url,
          nationality: scraped.nationality,
          position: scraped.position,
          all_positions: scraped.all_positions ?? null,
          style_of_play: scraped.style_of_play ?? null,
          born: scraped.born,
          height_cm: scraped.height_cm ?? null,
          photo_url: scraped.photo_url ?? null,
        })
        .returning();

      if (scraped.stints.length > 0) {
        await db.insert(career_stints).values(
          scraped.stints.map((s, i) => ({
            footballer_id: newFootballer.id,
            sort_order: i,
            years: s.years,
            club: s.club,
            club_wikipedia_url: s.club_wikipedia_url ?? null,
            apps: s.apps ?? null,
            goals: s.goals ?? null,
            stint_type: s.stint_type as "senior" | "international",
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
    } catch {
      return c.json({ valid: false, footballer: null, imported: false });
    }
  },
);
