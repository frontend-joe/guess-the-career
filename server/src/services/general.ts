import { sqlite } from "../db/client.ts";
import type { Candidate, Metric, TenableAnswer, TenableType } from "./tenable.ts";

// General Tenable — rounds whose answers are authored rather than derived.
//
// That is the whole of what the category means. Football's rounds are a query
// against the footballer database, so "the ten most capped Scots" improves
// every time the scraper runs. Nothing can derive the ten longest rivers, so a
// general round IS its answer list: typed in through the admin section and
// stored in general_rounds / general_answers (see migrations 0096 and 0101).
//
// It was called Geography until the rounds stopped all being geography. The
// subject lives on a round's topic, which is free text for exactly that reason:
// a new subject should cost somebody a sentence, not a release.
//
// Everything downstream of a round — the registry row, the multiplayer freeze,
// the guess matching, the board — is shared with football. This file is only
// the part that differs: where the ten answers come from.

export interface GeneralTopic {
  slug: string;
  label: string;
}

// Suggestions, not a fixed set. A topic carries no behaviour — it groups rounds
// on the admin screen and nothing else — so these are offered as autocomplete
// and a round is free to carry a subject nobody has thought of yet. Adding
// "Music" should not be a deploy.
export const GENERAL_TOPICS: GeneralTopic[] = [
  { slug: "countries", label: "Countries" },
  { slug: "cities", label: "Cities" },
  { slug: "rivers", label: "Rivers" },
  { slug: "mountains", label: "Mountains" },
  { slug: "lakes", label: "Lakes" },
  { slug: "islands", label: "Islands" },
  { slug: "seas", label: "Seas & oceans" },
  { slug: "deserts", label: "Deserts" },
  { slug: "states", label: "States & regions" },
  { slug: "capitals", label: "Capitals" },
  { slug: "words", label: "Words & language" },
  { slug: "music", label: "Music" },
  { slug: "film", label: "Film & TV" },
  { slug: "tech", label: "Technology" },
  { slug: "food", label: "Food & drink" },
  { slug: "sport", label: "Sport" },
  { slug: "science", label: "Science & nature" },
  { slug: "history", label: "History" },
  { slug: "culture", label: "Culture & tradition" },
  { slug: "games", label: "Games & toys" },
  { slug: "transport", label: "Transport" },
  { slug: "tv", label: "TV & radio" },
  { slug: "literature", label: "Books & plays" },
  { slug: "nature", label: "Nature & animals" },
  { slug: "money", label: "Money" },
];

export interface GeneralAnswerInput {
  name: string;
  aliases: string[];
  value: number;
  display: string | null;
}

export interface GeneralAnswerRow extends GeneralAnswerInput {
  position: number;
}

export interface GeneralRoundRow {
  slug: string;
  topic: string;
  title: string;
  ordered: boolean;
  unit: string | null;
  answerCount: number;
  /** The registry row in tenable_rounds, which is how the game knows it. */
  roundId: number | null;
  /** Out of the pool a host picks from, but still on file. See deleteGeneralRound. */
  retired: boolean;
  /** How many multiplayer rounds have been played from it. */
  games: number;
}

const PARAMS = (slug: string) => JSON.stringify({ round: slug });

// ── Reading ──────────────────────────────────────────────────────────────────

export function generalRounds(): GeneralRoundRow[] {
  return sqlite
    .prepare(
      `SELECT g.slug, g.topic, g.title, g.ordered, g.unit,
              (SELECT COUNT(*) FROM general_answers a WHERE a.round_slug = g.slug) AS answerCount,
              t.id AS roundId,
              COALESCE(t.enabled, 1) = 0 AS retired,
              (SELECT COUNT(*) FROM game_round_instances i WHERE i.round_id = t.id) AS games
       FROM general_rounds g
       LEFT JOIN tenable_rounds t
         ON t.category = 'general' AND t.type = 'general'
        AND t.params = '{"round":"' || g.slug || '"}'
       ORDER BY g.topic, g.title`,
    )
    .all()
    // SQLite has no booleans, so ordered and retired arrive as 0 or 1.
    .map((r) => {
      const row = r as Omit<GeneralRoundRow, "ordered" | "retired"> & { ordered: number; retired: number };
      return { ...row, ordered: !!row.ordered, retired: !!row.retired };
    });
}

export function generalAnswers(slug: string): GeneralAnswerRow[] {
  const rows = sqlite
    .prepare(
      `SELECT position, name, aliases, value, display
       FROM general_answers WHERE round_slug = ? ORDER BY position`,
    )
    .all(slug) as { position: number; name: string; aliases: string | null; value: number; display: string | null }[];
  return rows.map((r) => ({
    position: r.position,
    name: r.name,
    aliases: parseAliases(r.aliases),
    value: r.value,
    display: r.display,
  }));
}

export function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === "string") : [];
  } catch {
    return [];
  }
}

function roundBySlug(slug: string): { ordered: number; unit: string | null; title: string } | undefined {
  return sqlite
    .prepare(`SELECT ordered, unit, title FROM general_rounds WHERE slug = ?`)
    .get(slug) as { ordered: number; unit: string | null; title: string } | undefined;
}

// ── Writing ──────────────────────────────────────────────────────────────────

export interface GeneralRoundInput {
  slug: string;
  topic: string;
  title: string;
  ordered: boolean;
  unit: string | null;
  answers: GeneralAnswerInput[];
}

/**
 * Create or replace a round and its answers, and keep its registry row in step.
 *
 * The answers are replaced wholesale rather than diffed: the admin edits the
 * list as a list, and a round of ten rows is cheaper to rewrite than to
 * reconcile. A frozen multiplayer instance is unaffected either way — it took
 * its own copy.
 */
export function saveGeneralRound(input: GeneralRoundInput): { slug: string; roundId: number } {
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("A round needs a slug");
  if (!input.title.trim()) throw new Error("A round needs a title");

  return sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO general_rounds (slug, topic, title, ordered, unit)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (slug) DO UPDATE
           SET topic = excluded.topic, title = excluded.title,
               ordered = excluded.ordered, unit = excluded.unit`,
      )
      .run(slug, input.topic, input.title.trim(), input.ordered ? 1 : 0, input.unit || null);

    sqlite.prepare(`DELETE FROM general_answers WHERE round_slug = ?`).run(slug);
    const insert = sqlite.prepare(
      `INSERT INTO general_answers (round_slug, position, name, aliases, value, display)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    // An ordered round is a ranked list, so the stored order IS the board and
    // the admin's ordering is taken as given — no re-sorting by value behind
    // their back, which would silently disagree with what they just saw.
    input.answers.forEach((a, i) => {
      if (!a.name.trim()) return;
      insert.run(
        slug, i + 1, a.name.trim(),
        a.aliases.length ? JSON.stringify(a.aliases.map((x) => x.trim()).filter(Boolean)) : null,
        a.value || 0,
        a.display?.trim() || null,
      );
    });

    const answerCount = (sqlite
      .prepare(`SELECT COUNT(*) AS n FROM general_answers WHERE round_slug = ?`)
      .get(slug) as { n: number }).n;

    sqlite
      .prepare(
        `INSERT INTO tenable_rounds (category, type, params, metric, title, answer_count)
         VALUES ('general', 'general', ?, 'none', ?, ?)
         ON CONFLICT (type, params, metric) DO UPDATE
           -- enabled too: editing and saving a retired round is how you put it
           -- back in the pool, and silently leaving it retired would look like
           -- the save had failed.
           SET title = excluded.title, answer_count = excluded.answer_count, enabled = 1`,
      )
      .run(PARAMS(slug), input.title.trim(), answerCount);

    const roundId = (sqlite
      .prepare(`SELECT id FROM tenable_rounds WHERE type = 'general' AND params = ? AND metric = 'none'`)
      .get(PARAMS(slug)) as { id: number }).id;

    return { slug, roundId };
  })();
}

export interface GeneralDeleteResult {
  /** True when the round was kept on file and taken out of the pool instead. */
  retired: boolean;
  /** How many played rounds pointed at it. */
  games: number;
}

/**
 * Remove a round, or retire it if removing it would take a recording with it.
 *
 * game_round_instances.round_id is ON DELETE RESTRICT, and rightly: an instance
 * is the record of a round somebody played, and the registry row is how it
 * knows which question it was. Deleting out from under it would leave a
 * recording that cannot say what it was a recording of — and SQLite would
 * refuse anyway, which is where this used to surface as a bare constraint
 * error and a "Failed to delete round" with nothing to act on.
 *
 * So a round that has never been played is deleted outright, and a round that
 * has is retired: enabled = 0 takes it out of the pool a host picks from, which
 * is what deleting it was for, while the games that used it keep working. Its
 * answers stay, so it can be read back and — by saving it — brought back.
 */
export function deleteGeneralRound(slug: string): GeneralDeleteResult {
  return sqlite.transaction(() => {
    const registry = sqlite
      .prepare(`SELECT id FROM tenable_rounds WHERE type = 'general' AND params = ?`)
      .get(PARAMS(slug)) as { id: number } | undefined;

    const games = registry
      ? (sqlite
          .prepare(`SELECT COUNT(*) AS n FROM game_round_instances WHERE round_id = ?`)
          .get(registry.id) as { n: number }).n
      : 0;

    if (games > 0) {
      sqlite.prepare(`UPDATE tenable_rounds SET enabled = 0 WHERE id = ?`).run(registry!.id);
      return { retired: true, games };
    }

    // The registry row goes first: a round nobody can select is a better
    // half-deleted state than answers nobody can reach.
    sqlite
      .prepare(`DELETE FROM tenable_rounds WHERE type = 'general' AND params = ?`)
      .run(PARAMS(slug));
    sqlite.prepare(`DELETE FROM general_answers WHERE round_slug = ?`).run(slug);
    sqlite.prepare(`DELETE FROM general_rounds WHERE slug = ?`).run(slug);
    return { retired: false, games: 0 };
  })();
}

// ── The round type ───────────────────────────────────────────────────────────
//
// One Tenable type covers every authored round, whatever its subject. Football
// needs a type per question shape because each shape is a different query; here
// the query is always "this round's answers, in order", and what differs
// between rounds is data, not code.

export const generalType: TenableType = {
  slug: "general",
  category: "general",
  label: "General",
  description: "Authored list rounds — any subject, answers typed in by hand.",
  example: "The 10 longest rivers in the world",
  metricless: true,

  title(params) {
    return roundBySlug(params.round ?? "")?.title ?? "General round";
  },

  orderedFor(params) {
    // Unknown rounds are treated as ranked, which is the stricter reading: a
    // board that reveals at a rank is wrong in a visible way, where one that
    // fills in guess order quietly accepts anything.
    return roundBySlug(params.round ?? "")?.ordered !== 0;
  },

  answers(params, _metric, limit = 10): TenableAnswer[] {
    const round = roundBySlug(params.round ?? "");
    if (!round) return [];
    const rows = sqlite
      .prepare(
        `SELECT name, aliases, value, display FROM general_answers
         WHERE round_slug = ? ORDER BY position LIMIT ?`,
      )
      .all(params.round, limit) as {
      name: string; aliases: string | null; value: number; display: string | null;
    }[];
    return rows.map((r) => ({
      footballer_id: null,
      name: r.name,
      nationality: null,
      photo_url: null,
      value: r.value,
      unit: round.unit ?? undefined,
      display: r.display ?? undefined,
      aliases: parseAliases(r.aliases),
    }));
  },

  // Authored rounds are not discovered: there is no space of
  // candidates to browse, because every round that could exist already does
  // the moment somebody writes it down. The admin section for this category is
  // an editor rather than a picker.
  candidates(_metric: Metric): Candidate[] {
    return [];
  },
};
