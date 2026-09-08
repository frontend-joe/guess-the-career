import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sqlite } from "../db/client.ts";
import { getClubVariants } from "../services/football.ts";
import {
  dbFootballerByName,
  insertScrapedFootballer,
  resolveOrCreateFootballer,
} from "../services/playerImport.ts";
import { ONLY_PLAYER_SEED } from "../data/only-player-seed.ts";

export const onlyPlayerRouter = new Hono();

// ── helpers ──────────────────────────────────────────────────────────────────
function clubWiki(club: string): string | null {
  const row = sqlite
    .prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`)
    .get(club) as { wikipedia_url: string | null } | undefined;
  return row?.wikipedia_url ?? null;
}

// Combined senior appearances at a club (loan spells included).
function clubApps(footballerId: number, club: string): number {
  const variants = getClubVariants(club).map((v) => v.toLowerCase());
  const ph = variants.map(() => "?").join(", ");
  const row = sqlite
    .prepare(
      `SELECT SUM(COALESCE(cs.apps, 0)) as a FROM career_stints cs
       WHERE cs.footballer_id = ? AND cs.stint_type = 'senior'
         AND LOWER(TRIM(REPLACE(REPLACE(cs.club, '→', ''), '(loan)', ''))) IN (${ph})`,
    )
    .get(footballerId, ...variants) as { a: number } | undefined;
  return row?.a ?? 0;
}

function seedIfEmpty() {
  const n = (
    sqlite.prepare(`SELECT COUNT(*) as n FROM only_player_entries`).get() as {
      n: number;
    }
  ).n;
  if (n > 0) return;
  const insert = sqlite.prepare(
    `INSERT OR IGNORE INTO only_player_entries (nationality, club, player_name, period, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const tx = sqlite.transaction(() => {
    ONLY_PLAYER_SEED.forEach((e, i) =>
      insert.run(e.nationality, e.club, e.player, e.period, e.status, i),
    );
  });
  tx();
}

interface EntryRow {
  id: number;
  nationality: string;
  club: string;
  player_name: string;
  footballer_id: number | null;
  period: string | null;
  status: string | null;
  enabled: number;
  footballer_photo: string | null;
}

function shapeEntry(r: EntryRow) {
  return {
    id: r.id,
    nationality: r.nationality,
    club: r.club,
    clubWikiUrl: clubWiki(r.club),
    playerName: r.player_name,
    footballerId: r.footballer_id,
    footballerPhoto: r.footballer_photo,
    period: r.period,
    status: r.status,
    enabled: !!r.enabled,
  };
}

// ── Seed ─────────────────────────────────────────────────────────────────────
onlyPlayerRouter.post("/admin/seed", (c) => {
  const insert = sqlite.prepare(
    `INSERT OR IGNORE INTO only_player_entries (nationality, club, player_name, period, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  let added = 0;
  const tx = sqlite.transaction(() => {
    ONLY_PLAYER_SEED.forEach((e, i) => {
      added += insert.run(e.nationality, e.club, e.player, e.period, e.status, i).changes;
    });
  });
  tx();
  return c.json({ ok: true, added });
});

// ── Entries admin ────────────────────────────────────────────────────────────
onlyPlayerRouter.get("/admin/entries", (c) => {
  seedIfEmpty();
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") ?? "25", 10)));
  const q = (c.req.query("q") ?? "").trim().toLowerCase();

  const like = `%${q}%`;
  const where = q
    ? `WHERE LOWER(e.club) LIKE ? OR LOWER(e.nationality) LIKE ? OR LOWER(e.player_name) LIKE ?`
    : "";
  const whereArgs = q ? [like, like, like] : [];

  const total = (
    sqlite
      .prepare(`SELECT COUNT(*) as n FROM only_player_entries e ${where}`)
      .get(...whereArgs) as { n: number }
  ).n;
  const enabledCount = (
    sqlite
      .prepare(`SELECT COUNT(*) as n FROM only_player_entries WHERE enabled = 1`)
      .get() as { n: number }
  ).n;

  const rows = sqlite
    .prepare(
      `SELECT e.*, f.photo_url as footballer_photo
       FROM only_player_entries e
       LEFT JOIN footballers f ON f.id = e.footballer_id
       ${where}
       ORDER BY e.enabled DESC, e.club ASC, e.nationality ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...whereArgs, pageSize, (page - 1) * pageSize) as EntryRow[];

  return c.json({ data: rows.map(shapeEntry), total, enabledCount, page, pageSize });
});

onlyPlayerRouter.post(
  "/admin/entries",
  zValidator(
    "json",
    z.object({
      nationality: z.string().min(1),
      club: z.string().min(1),
      player_name: z.string().min(1),
      period: z.string().nullish(),
      status: z.string().nullish(),
    }),
  ),
  (c) => {
    const b = c.req.valid("json");
    const info = sqlite
      .prepare(
        `INSERT OR IGNORE INTO only_player_entries (nationality, club, player_name, period, status) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(b.nationality, b.club, b.player_name, b.period ?? null, b.status ?? null);
    return c.json({ ok: true, id: info.lastInsertRowid });
  },
);

onlyPlayerRouter.patch(
  "/admin/entries/:id",
  zValidator(
    "json",
    z.object({
      nationality: z.string().min(1).optional(),
      club: z.string().min(1).optional(),
      player_name: z.string().min(1).optional(),
      period: z.string().nullish(),
      status: z.string().nullish(),
      enabled: z.boolean().optional(),
    }),
  ),
  (c) => {
    const id = parseInt(c.req.param("id"), 10);
    const b = c.req.valid("json");
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const k of ["nationality", "club", "player_name", "period", "status"] as const) {
      if (b[k] !== undefined) {
        sets.push(`${k} = ?`);
        vals.push(b[k]);
      }
    }
    if (b.enabled !== undefined) {
      sets.push(`enabled = ?`);
      vals.push(b.enabled ? 1 : 0);
    }
    if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);
    sqlite.prepare(`UPDATE only_player_entries SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
    return c.json({ ok: true });
  },
);

onlyPlayerRouter.delete("/admin/entries/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  sqlite.prepare(`DELETE FROM only_player_entries WHERE id = ?`).run(id);
  return c.json({ ok: true });
});

// Link the answer player to a footballer (existing id, DB name, or Wikipedia scrape).
onlyPlayerRouter.post(
  "/admin/entries/:id/link",
  zValidator(
    "json",
    z.object({
      footballerId: z.number().int().optional(),
      name: z.string().optional(),
      wikipediaUrl: z.string().optional(),
    }),
  ),
  async (c) => {
    const id = parseInt(c.req.param("id"), 10);
    const entry = sqlite
      .prepare(`SELECT club FROM only_player_entries WHERE id = ?`)
      .get(id) as { club: string } | undefined;
    if (!entry) return c.json({ error: "Not found" }, 404);
    const { footballerId, name, wikipediaUrl } = c.req.valid("json");

    let fid: number | null = footballerId ?? null;
    try {
      if (fid == null && wikipediaUrl) fid = await insertScrapedFootballer(wikipediaUrl);
      else if (fid == null && name) {
        fid = dbFootballerByName(name) ?? (await resolveOrCreateFootballer(name, entry.club)).id;
      }
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Link failed" }, 400);
    }
    if (fid == null) return c.json({ error: "Could not resolve a footballer" }, 400);

    sqlite.prepare(`UPDATE only_player_entries SET footballer_id = ? WHERE id = ?`).run(fid, id);
    const f = sqlite
      .prepare(`SELECT id, name, photo_url FROM footballers WHERE id = ?`)
      .get(fid) as { id: number; name: string; photo_url: string | null };
    return c.json({ ok: true, footballer: f });
  },
);

// ── Schedule ─────────────────────────────────────────────────────────────────
onlyPlayerRouter.get("/schedule", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT s.id, s.date, s.entry_id, e.nationality, e.club, e.player_name
       FROM only_player_schedule s
       LEFT JOIN only_player_entries e ON e.id = s.entry_id
       ORDER BY s.date ASC`,
    )
    .all();
  return c.json(rows);
});

onlyPlayerRouter.get("/schedule/rounds", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT s.date, e.id as entry_id, e.nationality, e.club, e.player_name,
              e.footballer_id, f.photo_url, f.position
       FROM only_player_schedule s
       JOIN only_player_entries e ON e.id = s.entry_id
       LEFT JOIN footballers f ON f.id = e.footballer_id
       ORDER BY s.date ASC`,
    )
    .all() as {
    date: string;
    entry_id: number;
    nationality: string;
    club: string;
    player_name: string;
    footballer_id: number | null;
    photo_url: string | null;
    position: string | null;
  }[];

  return c.json(
    rows.map((r) => ({
      date: r.date,
      entryId: r.entry_id,
      nationality: r.nationality,
      club: r.club,
      clubWikiUrl: clubWiki(r.club),
      player: {
        name: r.player_name,
        footballerId: r.footballer_id,
        photoUrl: r.photo_url,
        position: r.position,
        apps: r.footballer_id ? clubApps(r.footballer_id, r.club) : null,
      },
    })),
  );
});

onlyPlayerRouter.put(
  "/schedule/:date",
  zValidator("json", z.object({ entryId: z.number().int() })),
  (c) => {
    const date = c.req.param("date");
    const { entryId } = c.req.valid("json");
    const existing = sqlite.prepare(`SELECT id FROM only_player_schedule WHERE date = ?`).get(date);
    if (existing) {
      sqlite.prepare(`UPDATE only_player_schedule SET entry_id = ? WHERE date = ?`).run(entryId, date);
    } else {
      sqlite.prepare(`INSERT INTO only_player_schedule (date, entry_id) VALUES (?, ?)`).run(date, entryId);
    }
    return c.json({ ok: true });
  },
);

onlyPlayerRouter.delete("/schedule/:date", (c) => {
  sqlite.prepare(`DELETE FROM only_player_schedule WHERE date = ?`).run(c.req.param("date"));
  return c.json({ ok: true });
});

onlyPlayerRouter.delete("/schedule", (c) => {
  sqlite.prepare(`DELETE FROM only_player_schedule`).run();
  return c.json({ ok: true });
});
