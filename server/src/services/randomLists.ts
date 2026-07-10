import { sqlite } from "../db/client.ts";
import { normalizeClubAlias } from "./scraper.ts";
import { reserveRe, isEnglishClub } from "./football.ts";

// ── Random Lists: bespoke, DB-derived player lists (one per round) ────────────
// Each list has a stable id + title/subtitle and a derive() that computes its
// player pool from the footballer DB. The whole pool are valid answers; how many
// you must find is the admin-set `target` (handled in the route).

export interface ListPlayer {
  id: number;
  name: string;
  photo_url: string | null;
  nationality: string | null;
  position: string | null;
  stat: string; // right-aligned display value (e.g. "6'2\"", "112 goals", "3 caps")
}

export interface ListDef {
  id: string;
  title: string;
  subtitle: string;
  derive: () => ListPlayer[];
}

// ── Shared data loaders ───────────────────────────────────────────────────────

interface FRow {
  id: number;
  name: string;
  photo_url: string | null;
  nationality: string | null;
  position: string | null;
  height_cm: number | null;
}

function allFootballers(): FRow[] {
  return sqlite
    .prepare(
      `SELECT id, name, photo_url, nationality, position, height_cm FROM footballers`,
    )
    .all() as FRow[];
}

// Sum a per-footballer senior-stint numeric field, excluding reserve/B/youth
// teams (via reserveRe on the alias-normalized club name).
function sumSenior(field: "goals" | "apps"): Map<number, number> {
  const rows = sqlite
    .prepare(
      `SELECT footballer_id, club, ${field} AS v FROM career_stints WHERE stint_type = 'senior'`,
    )
    .all() as { footballer_id: number; club: string; v: number | null }[];
  const m = new Map<number, number>();
  for (const r of rows) {
    if (reserveRe.test(normalizeClubAlias(r.club).trim())) continue;
    m.set(r.footballer_id, (m.get(r.footballer_id) ?? 0) + (r.v ?? 0));
  }
  return m;
}

// England senior caps per footballer (international stints for the England
// senior side; youth/B sides are stored under distinct club names).
function englandCaps(): Map<number, number> {
  const rows = sqlite
    .prepare(
      `SELECT footballer_id, apps FROM career_stints WHERE stint_type = 'international' AND TRIM(club) = 'England'`,
    )
    .all() as { footballer_id: number; apps: number | null }[];
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.footballer_id, (m.get(r.footballer_id) ?? 0) + (r.apps ?? 0));
  return m;
}

// Footballers with at least one senior stint at an English club.
function englishClubPlayers(): Set<number> {
  const rows = sqlite
    .prepare(`SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior'`)
    .all() as { footballer_id: number; club: string }[];
  const s = new Set<number>();
  for (const r of rows) if (isEnglishClub(r.club)) s.add(r.footballer_id);
  return s;
}

// ── Position classifiers (free-text, hyphen-tolerant; multi-value strings) ────

const lc = (s: string | null) => (s ?? "").toLowerCase();
const isFullBack = (p: string | null) =>
  /\b(full|right|left|wing)[ -]?back\b/.test(lc(p)) || lc(p).includes("wingback");
const isCentreBack = (p: string | null) =>
  /cent(re|er)[ -]?back/.test(lc(p)) ||
  lc(p).includes("central defender") ||
  /cent(re|er)[ -]?half/.test(lc(p));
// A pure midfielder — has "midfield" but is not also listed as a forward/striker.
const isMidfielder = (p: string | null) =>
  lc(p).includes("midfield") && !lc(p).includes("forward") && !lc(p).includes("striker");
const isDefender = (p: string | null) => {
  const s = lc(p);
  const def =
    /back\b/.test(s) ||
    s.includes("defender") ||
    s.includes("sweeper") ||
    s.includes("libero") ||
    /cent(re|er)[ -]?half/.test(s);
  return def && !s.includes("midfield") && !s.includes("forward") && !s.includes("striker") && !s.includes("winger");
};

// ft'in" from centimetres, e.g. 188 → 6'2"
function heightLabel(cm: number): string {
  const inch = Math.round(cm / 2.54);
  return `${Math.floor(inch / 12)}'${inch % 12}"`;
}

// ── Name dictionaries (seed lists — refine over time) ─────────────────────────
// Matched as a substring of any alphabetic token in the player's name.

const ANIMAL_WORDS = [
  "fish", "fox", "wolf", "bull", "lamb", "hart", "swan", "crane", "sparrow",
  "finch", "heron", "badger", "colt", "buck", "bird", "hawk", "crow", "drake",
  "robin", "starling", "wren", "peacock", "nightingale", "falcon",
  "eagle", "lion", "bear", "stag", "ram", "roe", "pigeon", "swift", "rook",
  "kite", "mallard", "partridge", "hind", "doe", "salmon", "pike", "seal",
  "hare", "crab", "raven", "gander", "bunny", "kestrel",
];

// Note: short colours like "red"/"amber" are omitted from the seed because they
// produce false positives (Fred, Chambers). Refine over time.
const COLOUR_WORDS = [
  "black", "white", "brown", "green", "gray", "grey", "gold", "silver",
  "scarlet", "blue",
];

function nameMatches(name: string, words: string[]): boolean {
  const tokens = name.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return tokens.some((t) => words.some((w) => t.includes(w)));
}

// ── Africa nationalities (no continent map exists in the codebase) ────────────
// Matched against the stored nationality noun/demonym, lowercased.
const AFRICA_NATIONS = new Set(
  [
    "Nigeria", "Nigerian", "Senegal", "Senegalese", "Ivory Coast", "Ivorian",
    "Cameroon", "Cameroonian", "Ghana", "Ghanaian", "Morocco", "Moroccan",
    "Mali", "Malian", "South Africa", "South African", "Algeria", "Algerian",
    "Egypt", "Egyptian", "Tunisia", "Tunisian", "DR Congo", "Congolese",
    "Congo", "Zimbabwe", "Zimbabwean", "Liberia", "Liberian", "Togo", "Togolese",
    "Sierra Leone", "Cape Verde", "Cape Verdean", "Guinea", "Guinean", "Gabon",
    "Gabonese", "Angola", "Angolan", "Zambia", "Zambian", "Kenya", "Kenyan",
    "Uganda", "Ugandan", "Burkina Faso", "Burkinabé", "Benin", "Beninese",
    "Mozambique", "Namibia", "Namibian", "Tanzania", "Tanzanian", "Sudan",
    "Sudanese", "Ethiopia", "Ethiopian", "Madagascar", "Malagasy", "Gambia",
    "Gambian", "Equatorial Guinea", "Guinea-Bissau", "Comoros", "Comorian",
  ].map((n) => n.toLowerCase()),
);
const isAfrican = (nat: string | null) => !!nat && AFRICA_NATIONS.has(nat.trim().toLowerCase());

// ── The 10 lists ──────────────────────────────────────────────────────────────

function base(f: FRow): Omit<ListPlayer, "stat"> {
  return { id: f.id, name: f.name, photo_url: f.photo_url, nationality: f.nationality, position: f.position };
}

export const LIST_DEFS: ListDef[] = [
  {
    id: "fullbacks-6ft",
    title: "Full-backs over 6ft",
    subtitle: "Full-backs taller than 6ft (183cm)",
    derive() {
      return allFootballers()
        .filter((f) => f.height_cm != null && f.height_cm > 183 && isFullBack(f.position))
        .sort((a, b) => (b.height_cm! - a.height_cm!) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: heightLabel(f.height_cm!) }));
    },
  },
  {
    id: "centrebacks-under-6ft",
    title: "Centre-backs under 6ft",
    subtitle: "Centre-backs shorter than 6ft (183cm)",
    derive() {
      return allFootballers()
        .filter((f) => f.height_cm != null && f.height_cm < 183 && isCentreBack(f.position))
        .sort((a, b) => (a.height_cm! - b.height_cm!) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: heightLabel(f.height_cm!) }));
    },
  },
  {
    id: "midfield-100-goals",
    title: "Midfield marksmen",
    subtitle: "Midfielders with 100+ senior career goals",
    derive() {
      const goals = sumSenior("goals");
      return allFootballers()
        .filter((f) => isMidfielder(f.position) && (goals.get(f.id) ?? 0) >= 100)
        .sort((a, b) => (goals.get(b.id)! - goals.get(a.id)!) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: `${goals.get(f.id)} goals` }));
    },
  },
  {
    id: "defender-50-goals",
    title: "Scoring defenders",
    subtitle: "Defenders with 50+ senior career goals",
    derive() {
      const goals = sumSenior("goals");
      return allFootballers()
        .filter((f) => isDefender(f.position) && (goals.get(f.id) ?? 0) >= 50)
        .sort((a, b) => (goals.get(b.id)! - goals.get(a.id)!) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: `${goals.get(f.id)} goals` }));
    },
  },
  {
    id: "africans-in-england",
    title: "Africans in England",
    subtitle: "African players who played in England",
    derive() {
      const apps = sumSenior("apps");
      const english = englishClubPlayers();
      return allFootballers()
        .filter((f) => isAfrican(f.nationality) && english.has(f.id))
        .sort((a, b) => ((apps.get(b.id) ?? 0) - (apps.get(a.id) ?? 0)) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: `${apps.get(f.id) ?? 0} apps` }));
    },
  },
  {
    id: "animal-names",
    title: "An animal in their name",
    subtitle: "Players with an animal hiding in their name",
    derive() {
      const apps = sumSenior("apps");
      return allFootballers()
        .filter((f) => nameMatches(f.name, ANIMAL_WORDS))
        .sort((a, b) => ((apps.get(b.id) ?? 0) - (apps.get(a.id) ?? 0)) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: `${apps.get(f.id) ?? 0} apps` }));
    },
  },
  {
    id: "colour-names",
    title: "A colour in their name",
    subtitle: "Players with a colour in their name",
    derive() {
      const apps = sumSenior("apps");
      return allFootballers()
        .filter((f) => nameMatches(f.name, COLOUR_WORDS))
        .sort((a, b) => ((apps.get(b.id) ?? 0) - (apps.get(a.id) ?? 0)) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: `${apps.get(f.id) ?? 0} apps` }));
    },
  },
  {
    id: "england-under-5-caps",
    title: "England cameos",
    subtitle: "Players with fewer than 5 England caps",
    derive() {
      const caps = englandCaps();
      return allFootballers()
        .filter((f) => {
          const c = caps.get(f.id) ?? 0;
          return c >= 1 && c < 5;
        })
        .sort((a, b) => (caps.get(b.id)! - caps.get(a.id)!) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: `${caps.get(f.id)} cap${caps.get(f.id) === 1 ? "" : "s"}` }));
    },
  },
  {
    id: "under-5ft7",
    title: "Pocket rockets",
    subtitle: "Players 5'7\" (170cm) and under",
    derive() {
      return allFootballers()
        .filter((f) => f.height_cm != null && f.height_cm <= 170)
        .sort((a, b) => (a.height_cm! - b.height_cm!) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: heightLabel(f.height_cm!) }));
    },
  },
  {
    id: "over-6ft5",
    title: "Giants",
    subtitle: "Players 6'5\" (196cm) and over",
    derive() {
      return allFootballers()
        .filter((f) => f.height_cm != null && f.height_cm >= 196)
        .sort((a, b) => (b.height_cm! - a.height_cm!) || a.name.localeCompare(b.name))
        .map((f) => ({ ...base(f), stat: heightLabel(f.height_cm!) }));
    },
  },
];

const LIST_BY_ID = new Map(LIST_DEFS.map((d) => [d.id, d]));

export function deriveList(id: string): ListPlayer[] | null {
  const def = LIST_BY_ID.get(id);
  return def ? def.derive() : null;
}

export function getListDef(id: string): ListDef | undefined {
  return LIST_BY_ID.get(id);
}

// Lightweight summaries (id/title/subtitle + pool size) for admin + schedule.
export function listSummaries(): { id: string; title: string; subtitle: string; poolCount: number }[] {
  return LIST_DEFS.map((d) => ({
    id: d.id,
    title: d.title,
    subtitle: d.subtitle,
    poolCount: d.derive().length,
  }));
}
